define(function() {;
    'use strict'
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

    return launchFullscreen;
});