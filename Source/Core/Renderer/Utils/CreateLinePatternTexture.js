define([
    '../../Constants/LineStyleDefs'
], function(LineStyleDefs) {
    'use strict';
    return function () {

        var h = LineStyleDefs.length;
        var w = 0;

        for (var i = 0; i < h; i++) {
            var ls = LineStyleDefs[i];

            if (ls.def.length > w)
                w = ls.def.length;
        }

        var pw = w + 3;
        var ph = h;

        var pot = 1;
        while (pot < pw)
            pot *= 2;
        pw = pot;

        pot = 1;
        while (pot < ph)
            pot *= 2;
        ph = pot;

        var tex = new Uint8Array(pw * ph);

        for (var j = 0; j < h; j++) {
            var off = j * pw;

            var ls = LineStyleDefs[j];

            //NOTE: The pattern scaling here just makes
            //the definitions in the texture consistent throughout in units of logical pixels (96 pixels per inch).
            //It does not apply scaling based on pen width or LTSCALE which should be done in shader.
            //Because we use a Byte texture, the maximum dash length at 96 dpi is about 2.5 inches, which
            //is enough for the patterns we have today. This can be easily fixed by changing to e.g. rgba8

            var dpi = 96;
            var unitScale = (ls.unit && ls.unit == "mm") ? 1.0 / 25.4 : 1.0;
            var penWidth = ls.pen_width || 0;

            var segs = ls.def;
            var patLen = 0;
            for (var i = 0; i < segs.length; i++) {

                var len = Math.abs(segs[i]);

                var isDot = (len <= penWidth * 0.5);
                //Is it a dot? (the ISO patterns define dot as segment with half a pen width)
                if (isDot)
                    len = 0;

                var ilen = 0 | (len * dpi * unitScale);

                patLen += ilen;

                //dot handling, set to 1 logical pixel in texture, since we need the 0 to indicate pattern end
                //the shader will interpret 1 as dot.
                tex[off + i + 2] = ilen ? ilen : 1;
            }

            //Two bytes to store total pattern length in the first two bytes of the texture row
            tex[off] = patLen % 256;
            tex[off + 1] = patLen / 256;

            //null terminate the pattern def in the texture so we know when to stop in the shader
            tex[off + segs.length + 2] = 0;
        }

        var lineStyleTex = new THREE.DataTexture(tex, pw, ph,
                                                    THREE.LuminanceFormat,
                                                    THREE.UnsignedByteType,
                                                    THREE.UVMapping,
                                                    THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
                                                    THREE.NearestFilter, THREE.NearestFilter, 0);

        lineStyleTex.generateMipmaps = false;
        lineStyleTex.flipY = false;
        lineStyleTex.needsUpdate = true;

        return lineStyleTex;
    };
});