define(['../Global', './getParameterByName'], function(Privite_Global, getParameterByName) {;
    'use strict'
    /**
     * 初始化全局env，offline
     * @param {*} options 
     */
    var initializeEnvironmentVariable = function (options) {
        var env;

        // Use the enviroment that was explicitly specified.
        //
        if (options && options.env) {
            env = options.env;
        }

        // If not available, check if the environment was specified in the query parameters.
        //
        if (!env) {
            env = getParameterByName("env");
        }

        if (options && options.offlineResourcePrefix) {
            Privite_Global.offlineResourcePrefix = options.offlineResourcePrefix;
        }

        if (options && options.offline && options.offline === "true") {
            Privite_Global.offline = true;
        }

        // If still not available, try to resolve the environment based on the url.
        //
        if (!env) {
            // FIXME: with the introduction of v2 end points, this would not work. We either
            // have to enforce user must pass an env variable to viewer, or parse URL here.
            switch (window.location.hostname) {
                case "viewing-dev.api.autodesk.com":
                    env = 'Development';
                    break;
                case "viewing-staging.api.autodesk.com":
                    env = 'Staging';
                    break;
                case "viewing.api.autodesk.com":
                    env = 'Production';
                    break;
                case "developer-dev.api.autodesk.com":
                    env = 'AutodeskDevelopment';
                    break;
                case "developer-stg.api.autodesk.com":
                    env = 'AutodeskStaging';
                    break;
                case "developer.api.autodesk.com":
                    env = 'AutodeskProduction';
                    break;

                case "localhost.autodesk.com":
                    env = 'Local';
                    break;
                case "": // IP addresses on Chrome.
                    env = 'Local';
                    break;
                case "127.0.0.1":
                    env = 'Local';
                    break;
                default:
                    env = 'AutodeskProduction';
            }
        }

        if (Privite_Global.ENABLE_TRACE) {
            if (typeof window !== "undefined")
                console.log("Host name : " + window.location.hostname);
            console.log("Environment initialized as : " + env);
        }
        Privite_Global.env = env;
    };

    return initializeEnvironmentVariable;
});