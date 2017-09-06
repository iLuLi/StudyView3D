define([
    './Chunks/PackDepthShaderChunk',
    './Chunks/CutPlanesShaderChunk'
], function(
    PackDepthShaderChunk,
    CutPlanesShaderChunk
) {;
    'use strict'
    return {
        uniforms: {
            "cutplanes": { type: "v4v", value: [] },
        },

        vertexShader: [
            "#ifdef USE_LOGDEPTHBUF",
            "    #ifdef USE_LOGDEPTHBUF_EXT",
            "        varying float vFragDepth;",
            "    #endif",
            "    uniform float logDepthBufFC;",
            "#endif",

            "#if NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",

            "void main() {",
            "    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );;",

            "#if NUM_CUTPLANES > 0",
            "    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
            "    vWorldPosition = worldPosition.xyz;",
            "#endif",

            "#ifdef USE_LOGDEPTHBUF",
            "    gl_Position.z = log2(max(1e-6, gl_Position.w + 1.0)) * logDepthBufFC;",
            "    #ifdef USE_LOGDEPTHBUF_EXT",
            "        vFragDepth = 1.0 + gl_Position.w;",
            "    #else",
            "        gl_Position.z = (gl_Position.z - 1.0) * gl_Position.w;",
            "    #endif",
            "#endif",
            "}"
        ].join("\n"),

        fragmentShader: [
            "#ifdef USE_LOGDEPTHBUF",
            "    uniform float logDepthBufFC;",
            "    #ifdef USE_LOGDEPTHBUF_EXT",
            "        #extension GL_EXT_frag_depth : enable",
            "        varying float vFragDepth;",
            "    #endif",
            "#endif",

            PackDepthShaderChunk,

            "#if NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",
            CutPlanesShaderChunk,

            "void main() {",
            "#if NUM_CUTPLANES > 0",
                "checkCutPlanes(vWorldPosition);",
            "#endif",

            "#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)",
                "gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;",
            "#endif",

            "#ifdef USE_LOGDEPTHBUF_EXT",
                "float depth = gl_FragDepthEXT / gl_FragCoord.w;",
            "#else",
                "float depth = gl_FragCoord.z / gl_FragCoord.w;",
            "#endif",
                "depth = 1.0 - depth;",
                "gl_FragColor = packDepth(depth);",
            "}"
        ].join("\n")
    };
});