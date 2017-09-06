define(function() {
    'use strict'
    var isBrowser = (typeof navigator !== "undefined");

    var isIE11 = isBrowser && !!navigator.userAgent.match(/Trident\/7\./);

    var isTouchDevice = function () {
        /*
        // Temporarily disable touch support through hammer on Android 5, to debug
        // some specific gesture issue with Chromium WebView when loading viewer3D.js.
        if (parseInt(getAndroidVersion()) == 5) {
            return false;
        }
        */
        console.log(1);
        return (typeof window !== "undefined" && "ontouchstart" in window);
    }();

    var isIOSDevice = function () {
        if (!isBrowser) return false;
        return /ip(ad|hone|od)/.test(navigator.userAgent.toLowerCase());
    }();
    
    var isAndroidDevice = function () {
        if (!isBrowser) return false;
        return (navigator.userAgent.toLowerCase().indexOf('android') !== -1);
    }();
    
    var isMobileDevice = function () {
        if (!isBrowser) return false;
        return isIOSDevice || isAndroidDevice;
    }();
    
    var isSafari = function () {
        if (!isBrowser) return false;
        var _ua = navigator.userAgent.toLowerCase();
        return (_ua.indexOf("safari") !== -1) && (_ua.indexOf("chrome") === -1);
    }();
    
    var isFirefox = function () {
        if (!isBrowser) return false;
        var _ua = navigator.userAgent.toLowerCase();
        return (_ua.indexOf("firefox") !== -1);
    }();
    
    var isMac = function () {
        if (!isBrowser) return false;
        var _ua = navigator.userAgent.toLowerCase();
        return (_ua.indexOf("mac os") !== -1);
    }();
    
    var isWindows = function () {
        if (!isBrowser) return false;
        var _ua = navigator.userAgent.toLowerCase();
        return (_ua.indexOf("win32") !== -1 || _ua.indexOf("windows") !== -1);
    }();

    // Get the version of the android device through user agent.
    // Return the version string of android device, e.g. 4.4, 5.0...
    var getAndroidVersion = function (ua) {
        var ua = ua || navigator.userAgent;
        var match = ua.match(/Android\s([0-9\.]*)/);
        return match ? match[1] : false;
    };

    return {
        isBrowser: isBrowser,
        isIE11: isIE11,
        isTouchDevice: isTouchDevice,
        isIOSDevice: isIOSDevice,
        isAndroidDevice: isAndroidDevice,
        isMobileDevice: isMobileDevice,
        isSafari: isSafari,
        isFirefox: isFirefox,
        isMac: isMac,
        isWindows: isWindows,
        
        getAndroidVersion: getAndroidVersion
    }
});