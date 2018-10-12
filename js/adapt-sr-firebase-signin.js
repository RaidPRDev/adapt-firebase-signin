define([
    'core/js/adapt',
    './firebaseSignInView',
    './firebaseSignInModel'
], function(Adapt, FirebaseSignInView, FirebaseSignInModel) {

    return Adapt.register("fb-signin", {
        view: FirebaseSignInView,
        model: FirebaseSignInModel
    });

});