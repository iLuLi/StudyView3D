define(['../DeviceType'], function(DeviceType) {;
    'use strict'
    var rescueFromPolymer = (function () {
        
        if (DeviceType.isSafari) {
    
            return function (object) {
    
                if (!window.Polymer)
                    return object;
    
                for (var p in object) {
                    if (p.indexOf("__impl") !== -1) {
                        return object[p];
                    }
                }
                return object;
            };
    
        } else {
    
            return function (o) { return o; };
    
        }
    
    })();

    return rescueFromPolymer;
});