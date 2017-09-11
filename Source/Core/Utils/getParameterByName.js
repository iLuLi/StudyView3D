define(['./getParameterByNameFromPath'], function(getParameterByNameFromPath) {;
    'use strict'
    // Returns the query parameter value from window url
    var getParameterByName = function (name) {
        if (typeof window === "undefined") {
            return "";
        }
        return getParameterByNameFromPath(name, window.location.href);
    };

    return getParameterByName;
});