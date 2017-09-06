define([
    '../Global',
    '../../Global',
    './getScript',
    './getParameterByNameFromPath'
], function(Privite_Global, Global, getScript, getParameterByNameFromPath) {
    'use strict';
    /**
     * 分析js文件所在目录
     * @param {*} options 
     */
    var initializeServiceEndPoints = function (options) {
        var env = Privite_Global.env;
        var config = Privite_Global.EnvironmentConfigurations[env];
        VIEWING_URL = config['VIEWING'];
        ACM_SESSION_URL = config['ACM'];
        OSS_URL = config['OSS'];

        if (Global.isNodeJS)
            return;

        //Derive the root for static viewer resources based on the
        //location of the main viewer script
        var libList = [
            "viewer3D.js",
            "viewer3D.min.js",
            "firefly.js",
            "firefly.min.js"
        ];
        if (options && options.hasOwnProperty('libraryName'))
            libList.push(options.libraryName);

        var root;
        var scriptUrl;

        // TODO_NOP: this doesn't work for Polymer / Web Components
        for (var i = 0; i < libList.length; i++) {
            var script = getScript(libList[i]);
            scriptUrl = script ? script.src : "";
            var idx = scriptUrl.indexOf(libList[i]);
            if (idx >= 0) {
                root = scriptUrl.substr(0, idx);
                break;
            }
        }

        //Derive any custom version request
        LMV_RESOURCE_VERSION = "v" + LMV_VIEWER_VERSION;

        var version = getParameterByNameFromPath("v", scriptUrl);
        if (version && version.length && version != LMV_RESOURCE_VERSION) {
            console.warn("Version string mismatch between requested and actual version: " + version + " vs. " + LMV_RESOURCE_VERSION + ". Using " + version);
            LMV_RESOURCE_VERSION = version;
        } else if (!version || !version.length) {
            LMV_RESOURCE_VERSION = null;
            console.info("No viewer version specified, will implicitly use " + LMV_VIEWER_VERSION);
        }

        LMV_RESOURCE_ROOT = root || LMV_RESOURCE_ROOT;
    };

    return initializeServiceEndPoints;
});