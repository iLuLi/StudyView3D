define([
    '../Core/Privite/Fn/DecodeEnvMap',
    'dependency'
], function(DecodeEnvMap, factory) {
    'use strict';

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
    return function (loadContext) {
        
        DecodeEnvMap(loadContext.map, loadContext.exposure, loadContext.useHalfFloat);

        self.postMessage({ map: loadContext.map, id: loadContext.id }, getTransferables(loadContext.map));
    };
});