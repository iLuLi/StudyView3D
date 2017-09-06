define(['../Core/Privite/Fn/getResourceUrl', './WORKER_DATA_URL'], function(getResourceUrl, W) {;
    'use strict'
    // Create a web worker.
    return function () {
        
        var w;

        // When we are not at release mode, create web worker directly from URL.
        if (ENABLE_INLINE_WORKER) {
            w = new Worker(W.WORKER_DATA_URL);
        } else {
            w = new Worker(getResourceUrl(LMV_WORKER_URL));
        }

        w.doOperation = w.postMessage;

        return w;
    };
});