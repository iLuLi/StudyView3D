define(['../Utils/getResourceUrl', '../Constants/Global'], function(getResourceUrl, Global) {;
    'use strict'
    // Create a web worker.
    return function () {
        
        var w;

        // When we are not at release mode, create web worker directly from URL.
        if (Global.ENABLE_INLINE_WORKER) {
            w = new Worker(Global.WORKER_DATA_URL);
        } else {
            w = new Worker(getResourceUrl(Global.LMV_WORKER_URL));
        }

        w.doOperation = w.postMessage;

        return w;
    };
});