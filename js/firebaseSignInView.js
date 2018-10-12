define([
	'core/js/adapt',
	'core/js/views/componentView'
], function(Adapt, ComponentView) {

    var FirebaseSignInView = ComponentView.extend({

		isFirebaseEnabled: false,
        logEnabled: false,
        databaseRef: "",

        // values: redirect, popup, auto [ redirect for mobile, popup for desktop ]
        signInMethod: "auto",

		events: {
			'click .google': 'onGoogleSignIn',
			'click .facebook': 'onFacebookSignIn',
			'click .sign-out-button': 'onSignOut',
		},

        initialize: function()
        {
            this.isFirebaseEnabled = (Adapt.firebase !== undefined);

            if (this.model.get('_signInMethod') !== undefined)
                this.signInMethod = this.model.get('_signInMethod');

            if (this.logEnabled)
                console.log("FirebaseSignIn.initialize().signInMethod:", this.signInMethod);

            if (this.isFirebaseEnabled )
            {
                // check if user signed in
                if (Adapt.firebase == null || Adapt.firebase.user == null)
                {
                    // wait for firebase ext to sign in user
                    this.listenTo(Adapt, { 'firebase:signedin': this.onFirebaseSignedIn });
                }
                else
                {
                    this.onFirebaseSignedIn({ success: true, user: Adapt.firebase.user });
                }
            }
            else console.warn("Firebase Extension is not enabled.");

            ComponentView.prototype.initialize.apply(this, arguments);
        },

        preRender: function()
        {
            if (this.logEnabled) console.log("FirebaseSignIn.preRender()");

            this.$('.sign-out').css("visibility", "hidden");
            this.$('.google').css("visibility", "visible");
            this.$('.facebook').css("visibility", "visible");

            ComponentView.prototype.preRender.apply(this, arguments);
        },

        postRender: function() {

		    // if a user is signed in...
            if (Adapt.firebase != null && Adapt.firebase.user != null)
                this.onFirebaseSignedIn({ success: true, user: Adapt.firebase.user });
        },

        onFirebaseSignedIn: function(result)
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onFirebaseSignedIn().result:", result);

            this.stopListening(Adapt, 'firebase:signedin');

            if (this.isFirebaseEnabled )
            {
                // check what signin method to use.
                // if auto, redirect is enabled on mobile devices
                // if (this.logEnabled) console.log("screenSize:", Adapt.device.screenSize);

                // check if user is signed in via auth
                var user = Adapt.firebase.user;

                if (Adapt.firebase.user != null)
                {
                    if (user.isAnonymous) this.hideUserInfo()
                    else this.showUserInfo(user)
                }
                else this.hideUserInfo();

                if ((this.signInMethod === "auto" && Adapt.device.screenSize === "small")
                    || (this.signInMethod === "redirect"))
                {
                    // create observer to capture on redirect
                    // but check if user has been authenticated
                    if (Adapt.firebase.user !== undefined) this.authorizeRedirectUser();
                }
            }

            if (this.logEnabled) console.log("FirebaseSignIn.setReadyStatus");
            this.setReadyStatus();
            this.setCompletionStatus();
        },

        showUserInfo: function(user) {

            this.$('.sign-out').css("visibility", "visible");
            this.$('.google').css("visibility", "hidden");
            this.$('.facebook').css("visibility", "hidden");

            this.$('.user-info').css("visibility", "visible");
            this.$('.user-name-label').html("Signed as: " + user.displayName);

            // trigger signed in for external components
            Adapt.trigger("firebase:signedin", {success: true, user:user});
        },

        hideUserInfo: function() {

            this.$('.sign-out').css("visibility", "hidden");
            this.$('.google').css("visibility", "visible");
            this.$('.facebook').css("visibility", "visible");

            this.$('.user-info').css("visibility", "hidden");
            this.$('.user-name-label').html("");
        },

        onSignOut: function(event)
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onSignOut()");
            event.preventDefault();

            this.onSignOutSession();
        },

        onSignOutSession: function()
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onSignOutSession()");

		    this.listenTo(Adapt, { 'firebase:signedout': this.onFirebaseSignedOutComplete });

            Adapt.firebase.onSignOutSession();
        },

        onFirebaseSignedOutComplete: function(result)
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onFirebaseSignedOutComplete()", result);

		    this.stopListening(Adapt, 'firebase:signedout');

		    this.hideUserInfo();

            // this.onGoogleMethodSignIn();
        },

        onFacebookSignIn: function(event)
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onFacebookSignIn()");
        },

        onGoogleSignIn: function(event)
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onGoogleSignIn()");

            if (!this.isFirebaseEnabled ) return;

            var parent = this;

            Adapt.firebase.api.auth()
                .signOut()
                .then(function() {
                    if (parent.logEnabled) console.log("FirebaseSignIn.signOut().success");

                    Adapt.trigger("firebase:signedout", {success: true});

                    parent.hideUserInfo();

                    var unsubscribe = Adapt.firebase.api.auth().onAuthStateChanged(
                        function(user)
                        {
                            // remove observer
                            unsubscribe();

                            if (user) {
                                // console.log("signing out... ", user);
                            }
                            else {
                                // we are not signed in
                                // console.log("signing out... user not signed in");
                                parent.onGoogleMethodSignIn();
                            }
                        });
                })
                .catch(function(error) {
                    console.log("FirebaseSignIn.signOut().error:", error);

                });
        },

        onGoogleMethodSignIn: function()
        {
            if (this.logEnabled) console.log("FirebaseSignIn.onGoogleMethodSignIn()");

            var user = Adapt.firebase.api.auth().currentUser;

            switch (this.signInMethod)
            {
                case "auto":
                    if (Adapt.device.screenSize == "small") {
                        this.googleSignInWithRedirect();
                    }
                    else this.googleSignInWithPopup();
                    break;

                case "redirect":
                    this.googleSignInWithRedirect();
                    break;

                case "redirect":
                    this.googleSignInWithPopup();
                    break;
            }
        },

        googleSignInWithPopup: function()
        {
            if (this.logEnabled) console.log("FirebaseSignIn.googleSignInWithPopup()");

		    var parent = this;
            var provider = new Adapt.firebase.api.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'    //  force to choose an account
            });

            Adapt.firebase.api.auth()
                .signInWithPopup(provider)
                .then(function(result)
                {
                    // This gives you a Google Access Token. You can use it to access the Google API.
                    var token = result.credential.accessToken;

                    if (parent.logEnabled)
                        console.log("FirebaseSignIn.onGoogleSignIn.user:", result.user);

                    // save user to database if needed
                    parent.authorizeUserWithPopup();
                })
                .catch(function(error)
                {
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    var email = error.email;

                    // The firebase.auth.AuthCredential type that was used.
                    var credential = error.credential;

                    if (parent.logEnabled)
                        console.log("FirebaseSignIn.onGoogleSignIn.error:", errorMessage);
                });
        },

        onUnSubscribeAuthChange: null,
        authorizeUserWithPopup: function()
        {
            if (this.logEnabled) console.log("FirebaseSignIn.authorizeUserWithPopup()");

            var parent = this;
            this.onUnSubscribeAuthChange = Adapt.firebase.api.auth().onAuthStateChanged(
                function(user)
                {
                    // remove observer
                    parent.onUnSubscribeAuthChange();

                    if (user)
                    {
                        if (parent.logEnabled)
                            console.log("[FirebaseSignIn] Save user info to database");

                        parent.showUserInfo(user);

                        setTimeout(function()
                        {
                            Adapt.firebase.initializeUserDatabase(user);
                        }, 3000);
                    }
                    else
                    {
                        // we are not signed in
                        if (parent.logEnabled)
                            console.log("[FirebaseSignIn] User not signed in");

                        parent.signInWithPopup();
                    }
                });
        },

        googleSignInWithRedirect: function() {
            console.log("FirebaseSignIn.googleSignInWithRedirect()");

            var parent = this;
            var provider = new Adapt.firebase.api.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'    //  force to choose an account
            });

            Adapt.firebase.api.auth()
                .signInWithRedirect(provider)
                .then(function(result)
                {
                    // This gives you a Google Access Token. You can use it to access the Google API.
                    var token = result.credential.accessToken;
                    console.log("FirebaseSignIn.onGoogleSignIn.user:", result.user);

                    // save user to database if needed
                    parent.authorizeUserWithPopup();

                })
                .catch(function(error)
                {
                    // Handle Errors here.
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    // The email of the user's account used.
                    var email = error.email;
                    // The firebase.auth.AuthCredential type that was used.
                    var credential = error.credential;

                    console.log("FirebaseSignIn.onGoogleSignIn.error:", error);
                });
        },

        authorizeRedirectUser: function() {
            if (this.logEnabled) console.log("FirebaseSignIn.authorizeRedirectUser()");
            var parent = this;

            var unsubscribe = Adapt.firebase.api.auth()
                .getRedirectResult()
                .then(function(result)
                {
                    if (result.credential)
                    {
                        var token = result.credential.accessToken;
                    }

                    if (parent.logEnabled)
                        console.log("FirebaseSignIn.authorizeRedirectUser.user:", result.user);

                    Adapt.firebase.initializeUserDatabase(result.user);

                }).catch(function(error)
                {
                    var errorCode = error.code;
                    var errorMessage = error.message;
                    var email = error.email;
                    var credential = error.credential;
                });
        },

        remove: function()
        {
            if (this.logEnabled)
                console.log("FirebaseSignIn.remove()");

            this.databaseRef = null;

            this.stopListening(Adapt, 'firebase:signedin');

            ComponentView.prototype.remove.apply(this, arguments);
		}
    });

    return FirebaseSignInView;

});

/*
,{
	template: 'fb-sign-in'
}
*/