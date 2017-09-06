define([
    './Chunks/PackDepthShaderChunk'
], function(PackDepthShaderChunk) {
    'use strict';
    //Shader used to convert the normals+depth texture into a smaller texture containing only depth
    //Since it packs depth into RGBA8 target it also maps it to the range 0-1 then packs that float
    //into an RGBA using magic.
    var SAOMinifyFirstShader = {

        uniforms: {
            "tDiffuse": { type: "t", value: null }, //Initial normals+depth texture

            "cameraNear": { type: "f", value: 1 },
            "cameraInvNearFar": { type: "f", value: 100 },

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
            "uniform float cameraNear;",
            "uniform float cameraInvNearFar;",

            //"varying vec2 vUv;",

            PackDepthShaderChunk,

            "void main() {",

            // Rotated grid subsampling to avoid XY directional bias or Z precision bias while downsampling.
            // On WebGL, the bit-and must be implemented with floating-point modulo........
            //"ivec2 ssP = ivec2(gl_FragCoord.xy);",
            //gl_FragColor = texelFetch2D(texture, clamp(ssP * 2 + ivec2(ssP.y & 1, ssP.x & 1), ivec2(0), textureSize(texture, previousMIPNumber) - ivec2(1)), previousMIPNumber);

            "vec2 ssP = vec2(gl_FragCoord.xy);",
            "ssP = ssP * 2.0 + mod(ssP, 2.0);",
            "ssP = (ssP + 0.5) * resolution * 0.5;",

    //            "depth = texture2D(tDiffuse, vUv).z;",
            "float depth = texture2D(tDiffuse, ssP).z;",

            "if (depth != 0.0)",
                "depth = (depth + cameraNear) * cameraInvNearFar;",
            "gl_FragColor = packDepth(depth);",

            "}"

        ].join("\n")

    };

    return SAOMinifyFirstShader;
});