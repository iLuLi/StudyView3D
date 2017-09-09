define([
    './Constants/DeviceType',
    './Utils/getContext'
], function(DeviceType, getContext) {
    'use strict';
    // fix IE events
    if (typeof window !== "undefined" && DeviceType.isIE11) {
        (function () {
            function CustomEvent(event, params) {
                params = params || { bubbles: false, cancelable: false, detail: undefined };
                var evt = document.createEvent('CustomEvent');
                evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
                return evt;
            };

            CustomEvent.prototype = window.CustomEvent.prototype;

            window.CustomEvent = CustomEvent;
        })();
    }

    // IE does not implement ArrayBuffer slice. Handy!
    if (!ArrayBuffer.prototype.slice) {
        ArrayBuffer.prototype.slice = function (start, end) {
            // Normalize start/end values
            if (!end || end > this.byteLength) {
                end = this.byteLength;
            }
            else if (end < 0) {
                end = this.byteLength + end;
                if (end < 0) end = 0;
            }
            if (start < 0) {
                start = this.byteLength + start;
                if (start < 0) start = 0;
            }

            if (end <= start) {
                return new ArrayBuffer();
            }

            // Bytewise copy- this will not be fast, but what choice do we have?
            var len = end - start;
            var view = new Uint8Array(this, start, len);
            var out = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
                out[i] = view[i];
            }
            return out.buffer;
        }
    }


    //The BlobBuilder object
    if (typeof window !== "undefined")
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;

    
    //Safari doesn't have the Performance object
    //We only need the now() function, so that's easy to emulate.
    var context = getContext();
    if (!context.performance)
        context.performance = Date;
    context.stderr = function () {
        console.warn('"stderr" is deprecated; please use "Autodesk.Viewing.Private.logger" instead');
    };

});