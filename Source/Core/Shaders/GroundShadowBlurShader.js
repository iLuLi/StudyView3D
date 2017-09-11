define([
    './Chunks/PackDepthShaderChunk'
], function(PackDepthShaderChunk) {
    'use strict';
    return {
        uniforms: {
            tDepth: { type: "t", value: null }
        },

        defines: {
            //     KERNEL_SCALE:  1.0 / 64.0,
            //     KERNEL_RADIUS: 7.0
            //      BOX : 1
        },

        vertexShader: [
            "varying vec2 vUv;",

            "void main() {",
                "vUv = vec2(uv.x, uv.y);",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}"
        ].join("\n"),

        fragmentShader: [
            "uniform sampler2D tDepth;",

            "varying vec2 vUv;",

            "#ifdef HORIZONTAL",
                "#define GET_UV(X) vec2(vUv.x + KERNEL_SCALE*(X), vUv.y)",
            "#else",
                "#define GET_UV(Y) vec2(vUv.x, vUv.y + KERNEL_SCALE*(Y))",
            "#endif",

            PackDepthShaderChunk,

            "#define PI 3.14159265358979",
            "#define SIGMA ((2.0 * KERNEL_RADIUS+1.0) / 6.0)",
            "#define SIGMASQ2 (2.0 * SIGMA * SIGMA)",
            "#ifdef BOX",
                "#define KERNEL_VAL(X) 1.0",
            "#else",
                "#define KERNEL_VAL(X) ( (1.0 / sqrt(PI * SIGMASQ2)) * exp(-(X)*(X)/SIGMASQ2) )",
            "#endif",

            "void main() {",
                "float depthVal = 0.0;",
                "float sum = 0.0;",
                "for (float x=-KERNEL_RADIUS; x<=KERNEL_RADIUS; x+=1.0) {",
                    "depthVal += unpackDepth(texture2D(tDepth, GET_UV(x))) * KERNEL_VAL(x);",
                    "sum += KERNEL_VAL(x);",
                "}",
                "gl_FragColor = packDepth(depthVal/sum);",
            "}"
        ].join("\n")
    };
});