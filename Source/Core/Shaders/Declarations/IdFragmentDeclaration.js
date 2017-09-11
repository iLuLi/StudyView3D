define(function() {;
    'use strict'
    return [
        "#if defined(MRT_NORMALS) || defined(MRT_ID_BUFFER)",
            "varying highp float depth;",
            "#define gl_FragColor gl_FragData[0]",
        "#endif",
        "#if defined(MRT_ID_BUFFER) || defined(ID_COLOR)",
            "uniform vec3 dbId;",
        "#endif",
        "#if defined(MRT_ID_BUFFER) || defined(MODEL_COLOR)",
            "uniform vec3 modelId;",
        "#endif"
    ].join("\n");
});