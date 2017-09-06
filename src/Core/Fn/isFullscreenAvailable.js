define(function() {;
    'use strict'
    var isFullscreenAvailable = function (element) {
        return element.requestFullscreen || element.mozRequestFullScreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
    }

    return isFullscreenAvailable;
});