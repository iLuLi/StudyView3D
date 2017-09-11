define(function() {;
    'use strict'
    var FXAAShader = {

        uniforms: {

            "tDiffuse": { type: "t", value: null },
            "uResolution": { type: "v2", value: new THREE.Vector2(1 / 1024, 1 / 512) }
        },

        vertexShader: [

            "uniform vec2 uResolution;",
            "varying vec2 vPos;",
            "varying vec4 vPosPos;",

            "void main() {",
                "vPos = uv;",
                "vPosPos.xy = uv + vec2(-0.5, -0.5) * uResolution;",
                "vPosPos.zw = uv + vec2( 0.5,  0.5) * uResolution;",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
            "}",

        ].join("\n"),

        fragmentShader: [

            "#define FXAA_EDGE_SHARPNESS (8.0)",
            "#define FXAA_EDGE_THRESHOLD (0.125)",
            "#define FXAA_EDGE_THRESHOLD_MIN (0.05)",
            "#define FXAA_RCP_FRAME_OPT (0.50)",
            "#define FXAA_RCP_FRAME_OPT2 (2.0)",

            "uniform sampler2D tDiffuse;",
            "uniform highp vec2 uResolution;",
            "varying vec2 vPos;",
            "varying vec4 vPosPos;",

            "float FxaaLuma(vec3 rgb) {",
                "return dot(rgb, vec3(0.299, 0.587, 0.114));",
            "}",

            "void main() {",
                "float lumaNw = FxaaLuma(texture2D(tDiffuse, vPosPos.xy).rgb);",
                "float lumaSw = FxaaLuma(texture2D(tDiffuse, vPosPos.xw).rgb);",
                "float lumaNe = FxaaLuma(texture2D(tDiffuse, vPosPos.zy).rgb) + 1.0/384.0;",
                "float lumaSe = FxaaLuma(texture2D(tDiffuse, vPosPos.zw).rgb);",

                "vec3 rgbM = texture2D(tDiffuse, vPos.xy).rgb;",
                "float lumaM = FxaaLuma(rgbM.rgb);",

                "float lumaMax = max(max(lumaNe, lumaSe), max(lumaNw, lumaSw));",
                "float lumaMin = min(min(lumaNe, lumaSe), min(lumaNw, lumaSw));",

                "float lumaMaxSubMinM = max(lumaMax, lumaM) - min(lumaMin, lumaM);",
                "float lumaMaxScaledClamped = max(FXAA_EDGE_THRESHOLD_MIN, lumaMax * FXAA_EDGE_THRESHOLD);",
                "if (lumaMaxSubMinM < lumaMaxScaledClamped) {",
                    "gl_FragColor = vec4(rgbM, 1.0);",
                    "return;",
                "}",

                "float dirSwMinusNe = lumaSw - lumaNe;",
                "float dirSeMinusNw = lumaSe - lumaNw;",
                "vec2 dir1 = normalize(vec2(dirSwMinusNe + dirSeMinusNw, dirSwMinusNe - dirSeMinusNw));",
                "vec3 rgbN1 = texture2D(tDiffuse, vPos.xy - dir1 * FXAA_RCP_FRAME_OPT*uResolution).rgb;",
                "vec3 rgbP1 = texture2D(tDiffuse, vPos.xy + dir1 * FXAA_RCP_FRAME_OPT*uResolution).rgb;",

                "float dirAbsMinTimesC = min(abs(dir1.x), abs(dir1.y)) * FXAA_EDGE_SHARPNESS;",
                "vec2 dir2 = clamp(dir1.xy / dirAbsMinTimesC, -2.0, 2.0);",
                "vec3 rgbN2 = texture2D(tDiffuse, vPos.xy - dir2 * FXAA_RCP_FRAME_OPT2*uResolution).rgb;",
                "vec3 rgbP2 = texture2D(tDiffuse, vPos.xy + dir2 * FXAA_RCP_FRAME_OPT2*uResolution).rgb;",

                "vec3 rgbA = rgbN1 + rgbP1;",
                "vec3 rgbB = ((rgbN2 + rgbP2) * 0.25) + (rgbA * 0.25);",

                "float lumaB = FxaaLuma(rgbB);",
                "if ((lumaB < lumaMin) || (lumaB > lumaMax))",
                    "gl_FragColor = vec4(rgbA * 0.5, 1.0);",
                "else",
                    "gl_FragColor = vec4(rgbB, 1.0);",
            "}",

        ].join("\n")

    };

    return FXAAShader;
        
});