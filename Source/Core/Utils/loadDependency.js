define(['./getResourceUrl'], function(getResourceUrl) {;
    'use strict'
    /**
     * Loads a script (e.g. an external library JS) and calls the callback once loaded.
     * Used for delayed loading of required libraries. Accepts both relative and absolute URLs.
     */
    var loadDependency = function (libNamespace, libName, callback) {
        if (typeof window[libNamespace] == "undefined") {
            var s = document.createElement("SCRIPT");
            s.src = libName.indexOf('://') > 0 ? libName : getResourceUrl(libName);
            document.head.appendChild(s);
            if (callback)
                s.onload = callback;
        }
        else if (callback)
            callback();
    };

    return loadDependency;
});