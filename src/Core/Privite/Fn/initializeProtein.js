define([
    '../../Logger',
    '../Global'
], function(Logger, Privite_Global) {
    'use strict';
    var initializeProtein = function () {
        
        //For local work, don't redirect texture requests to the CDN,
        //because local ones will load much faster, presumably.
        if (Privite_Global.ENABLE_DEBUG && Privite_Global.env == "Local" && !auth /* when auth is true, the viewer is operating under
        local mode but connect to remote server to get data. */)
            return;

        // In offline mode, viewer will get the texture from the locally cached SVF data sets, instead pinging texture
        // CDN.
        // TODO: this will break when translators stop including Protein into SVF.
        if (Privite_Global.offline) {
            return;
        }

        var xhr1 = new XMLHttpRequest();
        xhr1.open("GET", "https://raas-assets.autodesk.com/StaticContent/BaseAddress?family=protein", true);
        xhr1.responseType = "json";

        xhr1.onload = function (e) {
            var res = xhr1.response.url;
            if (res && res.length) {
                res = res.replace("http://", "https://");
                PROTEIN_ROOT = res + "/";
                Logger.info("Protein root is: " + PROTEIN_ROOT);
            }
        };

        xhr1.send();

        var xhr2 = new XMLHttpRequest();
        xhr2.open("GET", "https://raas-assets.autodesk.com/StaticContent/BaseAddress?family=prism", true);
        xhr2.responseType = "json";

        xhr2.onload = function (e) {
            var res = xhr2.response.url;
            if (res && res.length) {
                res = res.replace("http://", "https://");
                PRISM_ROOT = res + "/";
                Logger.info("Prism root is: " + PRISM_ROOT);
            }
        };

        //xhr.onerror = ;
        //xhr.ontimeout = ;

        xhr2.send();
    };

    return initializeProtein;
});