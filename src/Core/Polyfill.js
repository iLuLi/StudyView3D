define(['./DeviceType', './Fn/getContext', './Privite/Global'], function(DeviceType, getContext, Private_Global) {
    'use strict'

    /********* fix ************/
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
    (function () {
        var global = getContext();
        if (!global.performance)
            global.performance = Date;
    })();

    /*************************/
  
    var context = getContext();
    context.auth = null;
    context.VIEWING_URL = undefined;  //TODO
    context.ACM_SESSION_URL = undefined;
    context.OSS_URL = undefined;
    context.PROTEIN_ROOT = null;
    context.PRISM_ROOT = null;
    context.LOCALIZATION_REL_PATH = "";
    context.LMV_VIEWER_VERSION = "2.8";  // Gets replaced with content from deployment/package.json
    context.LMV_VIEWER_PATCH = "46";// Gets replaced with build number from TeamCity
    context.LMV_BUILD_TYPE = "Production"; // Either Development, Staging or Production
    context.LMV_RESOURCE_VERSION = null;
    context.LMV_RESOURCE_ROOT = "";
    context.LMV_THIRD_PARTY_COOKIE = undefined;
    context.stderr = function () {
        console.warn('"stderr" is deprecated; please use "Autodesk.Viewing.Private.logger" instead');
    };

    //Those are globals -- set by the build system.
    context.LMV_WORKER_URL = Private_Global.LMV_WORKER_URL || "src/workers/MainWorker-web.js";
    context.ENABLE_INLINE_WORKER = Private_Global.ENABLE_INLINE_WORKER || false;
    
});