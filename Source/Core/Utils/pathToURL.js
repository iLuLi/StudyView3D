define(function() {;
    'use strict'
    //Maps a relative resource path (like a pack file or texture)
    //to an absolute URL (possibly signed).
    return function (path) {
        
        if (path.indexOf("://") !== -1 ||
            path.indexOf("urn:") === 0) {
            return path;
        }

        if (typeof window === "undefined")
            return path;

        var rootRelPath = window.location.pathname;
        //chop off the index.html part
        var lastSlash = rootRelPath.lastIndexOf("/");
        rootRelPath = rootRelPath.substr(0, lastSlash + 1);
        var absPath = window.location.protocol + "//" + window.location.host + rootRelPath + path;
        return absPath;
    };
});