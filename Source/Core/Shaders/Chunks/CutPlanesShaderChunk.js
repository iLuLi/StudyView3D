define(function() {;
    'use strict'
    // requires vWorldPosition
    return [
        "#if NUM_CUTPLANES > 0",
            "uniform vec4 cutplanes[NUM_CUTPLANES];",

            "void checkCutPlanes(vec3 worldPosition) {",
                "for (int i=0; i<NUM_CUTPLANES; i++) {",
                    // test if point is outside of cutting plane; if so, discard fragment
                    "if (dot(vec4(worldPosition, 1.0), cutplanes[i]) > 0.0) {",
                        "discard;",
                    "}",
                "}",
            "}",
        "#endif",
    ].join("\n");
});