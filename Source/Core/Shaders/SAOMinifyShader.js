define([
    './Chunks/PackDepthShaderChunk'
], function(require) {
    'use strict';

    //Shader used to generate mip levels for the depth texture (used by the SAO shader)
    var SAOMinifyShader = {

        uniforms: {
            "tDiffuse": { type: "t", value: null }, //Lower mip level
            "resolution": { type: "v2", value: new THREE.Vector2(1.0 / 512, 1.0 / 512) } //1/size of lower mip level
        },

        vertexShader: [

            //"varying vec2 vUv;",

            "void main() {",

            //"vUv = uv;",
            "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform sampler2D tDiffuse;",
            "uniform vec2 resolution;",

            //"varying vec2 vUv;",

            "void main() {",

            // Rotated grid subsampling to avoid XY directional bias or Z precision bias while downsampling.
            // On WebGL, the bit-and must be implemented with floating-point modulo........
            //"ivec2 ssP = ivec2(gl_FragCoord.xy);",
            //gl_FragColor = texelFetch2D(texture, clamp(ssP * 2 + ivec2(ssP.y & 1, ssP.x & 1), ivec2(0), textureSize(texture, previousMIPNumber) - ivec2(1)), previousMIPNumber);


            "vec2 ssP = vec2(gl_FragCoord.xy);",
            "ssP = ssP * 2.0 + mod(ssP, 2.0);",
            "ssP = (ssP + 0.5) * resolution * 0.5;",
            "gl_FragColor = texture2D(tDiffuse, ssP);",

    //            "gl_FragColor = texture2D(tDiffuse, vUv);",

            "}"

        ].join("\n")

    };

    return SAOMinifyShader;
});