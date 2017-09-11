define(function() {;
    'use strict'
    /**
     * Detects if WebGL is enabled.
     *
     * @return { number } -1 for not Supported,
     *                    0 for disabled
     *                    1 for enabled
     */
    var detectWebGL = function () {
        // Check for the webgl rendering context
        if (!!window.WebGLRenderingContext) {
            var canvas = document.createElement("canvas"),
                names = ["webgl", "experimental-webgl", "moz-webgl", "webkit-3d"],
                context = false;

            for (var i = 0; i < 4; i++) {
                try {
                    context = canvas.getContext(names[i]);
                    context = rescueFromPolymer(context);
                    if (context && typeof context.getParameter === "function") {
                        // WebGL is enabled.
                        //
                        return 1;
                    }
                } catch (e) { }
            }

            // WebGL is supported, but disabled.
            //
            return 0;
        }

        // WebGL not supported.
        //
        return -1;
    };

    return detectWebGL;
});