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

    return inFullscreen;
});