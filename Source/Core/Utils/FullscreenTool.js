define(function() {;
    'use strict'
    // Determines if the browser is in full screen
    var inFullscreen = function () {
        
        // Special case for Ms-Edge that has webkitIsFullScreen with correct value
        // and fullscreenEnabled with wrong value (thanks MS)
        if ("webkitIsFullScreen" in document) return document.webkitIsFullScreen;
        return !!(document.mozFullScreenElement ||
            document.msFullscreenElement ||
            document.fullscreenEnabled || // Check last-ish because it is true in Ms-Edge
            document.querySelector(".viewer-fill-browser")); // Fallback for iPad
    }

    // Exit full screen with the available method
    var exitFullscreen = function () {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Launch full screen on the given element with the available method
    var launchFullscreen = function (element, options) {
        if (element.requestFullscreen) {
            element.requestFullscreen(options);
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen(options);
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen(options);
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen(options);
        }
    }

    return {
        inFullscreen: inFullscreen,
        launchFullscreen: launchFullscreen,
        exitFullscreen: exitFullscreen
    }
});