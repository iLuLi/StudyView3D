define(function() {
    'use strict';
    var startLiveReviewSession = function () {
        if (!avec.Panel) return;
        avec.Panel.startSession();
    };

    /**
     *  End a Live Review Session.
     */
    var endLiveReviewSession = function () {
        if (!avec.Panel) return;
        avec.Panel.endSession();
    };

    return {
        startLiveReviewSession: startLiveReviewSession,
        endLiveReviewSession: endLiveReviewSession
    }
});