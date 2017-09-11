define(["./IdOutputShaderChunk"], function(IdOutputShaderChunk) {;
    'use strict'
    return [
        
        "#ifdef HATCH_PATTERN",
            "gl_FragColor = calculateHatchPattern(hatchParams, gl_FragCoord.xy, gl_FragColor, hatchTintColor, hatchTintIntensity);",
        "#endif",

        "#if defined(USE_LOGDEPTHBUF) && defined(USE_LOGDEPTHBUF_EXT)",
            "gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;",
        "#endif",

        "#ifdef MRT_NORMALS",
            //We cannot avoid blending in the depth target when blending
            //to the color target is on, so
            //we pack the normal and depth in the first three elements
            //and use 0 or 1 as the alpha.
            //NOTE: Dropping the Z coordinate of the normal entirely means
            //that we lose information about its sign (we use sqrt to restore it later).
            //This is OK in this case because in view space surfaces that we see will have
            //positive Z component in all cases. If that changes we have to also
            //encode the sign bit in the x or y.
            "gl_FragData[1] = vec4(geomNormal.x, geomNormal.y, depth, gl_FragColor.a < 1.0 ? 0.0 : 1.0);",
        "#endif",

        IdOutputShaderChunk

    ].join("\n");
});