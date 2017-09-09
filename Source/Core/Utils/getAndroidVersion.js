define(function() {
    'use strict'
    // Get the version of the android device through user agent.
    // Return the version string of android device, e.g. 4.4, 5.0...
    return function (ua) {
        var ua = ua || navigator.userAgent;
        var match = ua.match(/Android\s([0-9\.]*)/);
        return match ? match[1] : false;
    }
});