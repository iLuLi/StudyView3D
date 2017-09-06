define(function() {;
    'use strict'
    var fullscreenElement = function () {
        return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    }

    return fullscreenElement;
});