define(function() {;
    'use strict'
    function getContext() {
        return (typeof window !== "undefined" && window !== null)
            ? window
            : (typeof self !== "undefined" && self !== null)
                ? self
                : GLOBAL;
    }

    return getContext;
});