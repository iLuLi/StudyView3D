define([
    './getResourceUrl',
    '../Constants/Global'
], function(getResourceUrl, Global) {
    'use strict';
    // A cache of entire worker script as data URL.
    // var WORKER_DATA_URL = null;
    var WORKER_FETCHING_SCRIPT = false;
    var WORKER_FETCHING_CALLBACKS = [];


    return  function (successCB, errorCB) {

        if (Global.ENABLE_INLINE_WORKER && !Global.WORKER_DATA_URL) {

            WORKER_FETCHING_CALLBACKS.push({
                successCB: successCB
            });

            if (WORKER_FETCHING_SCRIPT) {
                return;
            }

            var xhr = new XMLHttpRequest();
            var scriptURL = Global.LMV_WORKER_URL;

            // We need to request the same version of the library for this worker.  Take the original
            // script url, which will already have the version string (if provided).
            //
            var originalScriptURL = getResourceUrl(Global.LMV_WORKER_URL);

            if (originalScriptURL) {
                scriptURL = originalScriptURL;
            }

            xhr.open("GET", scriptURL, true);
            xhr.withCredentials = false;

            xhr.onload = function () {

                // Set up global cached worker script.
                WORKER_FETCHING_SCRIPT = false;
                var blob;
                window.URL = window.URL || window.webkitURL;

                try {
                    blob = new Blob([xhr.responseText], { type: 'application/javascript' });
                } catch (e) {
                    // Backward compatibility.
                    blob = new BlobBuilder();
                    blob.append(xhr.responseText);
                    blob = blob.getBlob();
                }
                Global.WORKER_DATA_URL = URL.createObjectURL(blob);

                var callbacks = WORKER_FETCHING_CALLBACKS.concat(); // Shallow copy
                WORKER_FETCHING_CALLBACKS = [];
                for (var i = 0; i < callbacks.length; ++i) {
                    callbacks[i].successCB && callbacks[i].successCB();
                }
            };

            WORKER_FETCHING_SCRIPT = true;
            xhr.send();

        } else {
            if (successCB)
                successCB();
        }

    };
});