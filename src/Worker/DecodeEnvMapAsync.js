define([
    '../Core/Logger',
    './createWorker',
    '../Core/Privite/Global'
], function(Logger, createWorker, Privite_Global) {
    'use strict';
    var messageId = 1;
    
    function getTransferables(map) {

        var res = [];

        // if `map.image` is an array, use it as it is, otherwise create an array with single item (`map.image`) in it
        var images = Array.isArray(map.image) ? map.image : [map.image];

        for (var i = 0; i < images.length; i++) {

            var image = images[i];

            for (var j = 0; j < image.mipmaps.length; j++) {

                var mipmap = image.mipmaps[j];

                res.push(mipmap.data.buffer);
            }
        }

        return res;
    }

    return function (map, exposure, useHalfFloat, callback) {

        if (!map.LogLuv) {
            Logger.warn("Environment map expected to be in LogLuv format.");
            return;
        }

        if (!Privite_Global.imageWorker)
            Privite_Global.imageWorker = createWorker();

        var id = messageId++;

        var onMessage = function (msg) {

            if (msg.data.id !== id)
                return;

            Privite_Global.imageWorker.removeEventListener("message", onMessage);

            var mapWorker = msg.data.map;
            map.image = mapWorker.image;

            map.LogLuv = false;

            if (useHalfFloat) {
                map.type = THREE.HalfFloatType;
                map.format = THREE.RGBFormat;
                map.RGBM = false;
                map.GammaEncoded = true;
            }
            else
                map.RGBM = true;

            callback(map);
        };

        Privite_Global.imageWorker.addEventListener("message", onMessage);

        Privite_Global.imageWorker.postMessage({
            operation: "DECODE_ENVMAP",
            map: map,
            exposure: exposure,
            useHalfFloat: useHalfFloat,
            id: id
        }, getTransferables(map));
    };
});