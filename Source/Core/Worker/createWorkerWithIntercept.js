define([
    './createWorker',
    '../Constants/Global'
], function(createWorker, Globa) {
    'use strict';
    return function () {
        var worker = createWorker();

        worker.checkEvent = function (e) {
            if (e.data && e.data.assetRequest) {
                if (Globa.assets) {
                    Globa.assets.push(e.data.assetRequest)
                }
                return true;
            }
            return false;
        };

        var interceptListeners = [];
        function popCallback(listener) {
            if (!interceptListeners) return null;
            for (var i = 0; i < interceptListeners.length; ++i) {
                if (interceptListeners[i].arg === listener) {
                    var ret = interceptListeners[i].callback;
                    interceptListeners.splice(i, 1);
                    if (interceptListeners.length === 0)
                        interceptListeners = null;
                    return ret;
                }
            }
            return null;
        }

        worker.addEventListenerWithIntercept = function (listener) {

            var callbackFn = function (ew) {
                if (worker.checkEvent(ew))
                    return;

                listener(ew);
            };

            if (!interceptListeners) interceptListeners = [];
            interceptListeners.push({ arg: listener, callback: callbackFn });
            worker.addEventListener('message', callbackFn, false);
            return callbackFn;
        };

        worker.removeEventListenerWithIntercept = function (listener) {
            var callbackFn = popCallback(listener);
            if (callbackFn) {
                worker.removeEventListener('message', callbackFn, false);
            }
        };

        worker.clearAllEventListenerWithIntercept = function () {
            if (!interceptListeners) return;
            var copy = interceptListeners.concat();
            for (var i = 0; i < copy.length; ++i) {
                worker.removeEventListenerWithIntercept(copy[i].arg);
            }
        };

        return worker;
    }
});