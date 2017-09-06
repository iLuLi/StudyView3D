define(function() {;
    'use strict'
    // return value of parameter from a url
    var getParameterByNameFromPath = function (name, url) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(url);
        if (results == null)
            return "";
        else
            return decodeURIComponent(results[1].replace(/\+/g, " "));
    };

    return getParameterByNameFromPath;
});