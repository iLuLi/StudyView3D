define([
    './Chunks/PackDepthShaderChunk'
], function(PackDepthShaderChunk) {
    'use strict';
    return {
        uniforms: {
            tDepth: { type: "t", value: null },
            uShadowColor: { type: "v4", value: new THREE.Vector4(0, 0, 0, 1) },
        },

        vertexShader: [
            "varying vec2 vUv;",

            "void main() {",
            "    vUv = vec2(uv.x, uv.y);",
            "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}"
        ].join("\n"),

        fragmentShader: [
            "uniform sampler2D tDepth;",
            "uniform vec4 uShadowColor;",
            "varying vec2 vUv;",

            PackDepthShaderChunk,

            "void main() {",
                "float depthVal = unpackDepth(texture2D(tDepth, vUv));",
                //"depthVal *= depthVal;", //Nop's gamma correction
                "gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * depthVal);",
            "}"
        ].join("\n")
    };
});