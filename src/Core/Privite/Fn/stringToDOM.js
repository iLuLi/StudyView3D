define(function() {;
    'use strict'
    return function (str) {
        var d = document.createElement("div");
        d.innerHTML = str;
        return d.firstChild;
    };
});