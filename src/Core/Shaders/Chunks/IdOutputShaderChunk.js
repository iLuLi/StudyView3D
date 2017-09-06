define(function() {;
    'use strict'

    // If ENABLE_ID_DISCARD is set, a float variable writeId must be defined
    // id is then written if writeId is !=0.0.
    return [

        "#ifdef MRT_ID_BUFFER",
            //When using MRT, we have to set the alpha channel to 1
            //in order to override alpha blending (which cannot be individually controlled per target
            //and we need it for the color target)
            "#ifdef MRT_NORMALS",
                "const int index = 2;",
            "#else",
                "const int index = 1;",
            "#endif",

            // if discarding of IDs is disabled, always use alpha 1.0, otherwise choose based on
            "#ifndef ENABLE_ID_DISCARD",
                "const float writeId = 1.0;",
            "#endif",

            "gl_FragData[index] = vec4(dbId.rgb, writeId);",
            "#ifdef MODEL_COLOR",
                "gl_FragData[index+1] = vec4(modelId.rgb, writeId);",
            "#endif",
        "#elif defined(ID_COLOR)",

            // discard fragment if wanted. Note that this is only possible because we
            // we are solely writing IDs in this case, so that discard will not affect
            // other targets.
            "#ifdef ENABLE_ID_DISCARD",
                "if (writeId==0.0) {",
                    "discard;",
                "}",
            "#endif",

            "gl_FragColor = vec4(dbId.rgb, 1.0);",
        "#elif defined(MODEL_COLOR)",

            // discard fragment if wanted (see above)
            "#ifdef ENABLE_ID_DISCARD",
                "if (writeId==0.0) {",
                    "discard;",
                "}",
            "#endif",

            //here we assume that in case we are only rendering
            //to an ID target, blending is off, so we can use
            //the alpha channel as well (which is usually 0 for IDs and will cause the pixels to be discarded).
            "gl_FragColor = vec4(modelId.rgb, 1.0);",
        "#endif"

    ].join("\n");
});