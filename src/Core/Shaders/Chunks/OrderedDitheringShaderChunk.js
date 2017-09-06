define(function() {;
    'use strict'
    return [
        "vec3 orderedDithering(vec3 col) {",
            //Matrix for 4x4 ordered dithering. (http://en.wikipedia.org/wiki/Ordered_dithering)
            "const vec4 m0 = vec4( 1.0, 13.0,  4.0, 16.0);",
            "const vec4 m1 = vec4( 9.0,  5.0, 12.0,  8.0);",
            "const vec4 m2 = vec4( 3.0, 15.0,  2.0, 14.0);",
            "const vec4 m3 = vec4(11.0,  7.0, 10.0,  6.0);",

            //No integer & in WebGL, otherwise we would do &3...
            "int i = int(mod(float(gl_FragCoord.x), 4.0));",
            "int j = int(mod(float(gl_FragCoord.y), 4.0));",

            //Ideally we would index i*4+j into an array of 16 floats, but WebGL doesn't allow
            //access with non-constant index. Using a texture for a 4x4 seems like overkill.
            "vec4 biasRow;",
            "if      (i==0) biasRow = m0;",
            "else if (i==1) biasRow = m1;",
            "else if (i==2) biasRow = m2;",
            "else           biasRow = m3;",
            "float bias;",
            "if      (j==0) bias = biasRow.x;",
            "else if (j==1) bias = biasRow.y;",
            "else if (j==2) bias = biasRow.z;",
            "else           bias = biasRow.w;",

            "return col + bias / 17.0 / 256.0;",
        "}",
    ].join("\n");
});