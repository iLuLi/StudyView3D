define([
    './Chunks/TonemapShaderChunk'
], function(TonemapShaderChunk) {
    'use strict';

    //Shader that composes a final frame from the color target, SSAO target and overlays target.
    var BlendShader = {
        
        uniforms: {
            "tDiffuse": { type: "t", value: null }, //Color buffer containing the rendered 3d model

            "tAO": { type: "t", value: null }, //Ambient occlusion + depth buffer
            "useAO": { type: "i", value: 0 }, //Whether to blend in the AO buffer

            "tOverlay": { type: "t", value: null }, //The selection/overlays buffer
            "useOverlay": { type: "i", value: 0 }, //Whether to blend in the overlays

            "tID": { type: "t", value: null }, //The ID buffer
            "objID": { type: "i", value: 0 }, //The currently highlighted object ID (0 means no highlight)
            "objIDv3": { type: "v3", value: new THREE.Vector3(0, 0, 0) }, //The currently highlighted object ID as RGB triplet
            "highlightIntensity": { type: "f", value: 1.0 },

            "resolution": { type: "v2", value: new THREE.Vector2(1 / 1024, 1 / 512) }, // 1/size

            //Enable these if the forward pass renders in HDR-linear target and the Blend shader is doing the tone mapping
            //"exposureBias" : { type:"f", value: 1.0 },
            //"toneMapMethod" : { type:"i", value: 0 }

            "highlightRange": { type: "i", value: 0 },
            "objIDStart": { type: "i", value: 0 },
            "objIDEnd": { type: "i", value: 0 }
        },


        defines: {
        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "vUv = uv;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform sampler2D tDiffuse;",
            "uniform sampler2D tAO;",
            "uniform int useAO;",
            "uniform sampler2D tOverlay;",
            "uniform int useOverlay;",
            "uniform vec2 resolution;",
            //"uniform float exposureBias;",
            //"uniform int toneMapMethod;",
            "uniform int objID;",
            "uniform vec3 objIDv3;",
            "uniform sampler2D tID;",
            "uniform float highlightIntensity;",

            "uniform int highlightRange;",
            "uniform int objIDStart;",
            "uniform int objIDEnd;",

            "varying vec2 vUv;",

            TonemapShaderChunk,

            // search 3x3 neighbors
            // the current pixel is outline if
            // (is selection && has empty neighbor) || (pixel is empty && has selection neighbor)
            "vec4 overlayEdgeDetect(vec2 vUv) {",
                "#define IS_SELECTION(C) ( (C).b > (C).r && (C).b > (C).g )",   // our color key
                "#define CHECK_EDGE_ALPHA(I, J)     { vec4 c = texture2D( tOverlay, vUv+resolution*vec2((I),(J)) ); maxAlpha = max(maxAlpha, c.a); if (c.a > 0.0 && IS_SELECTION(c)) { hasEdge++; selectionPixel = c; } }",
                "#define CHECK_EDGE_SELECTION(I, J) { vec4 c = texture2D( tOverlay, vUv+resolution*vec2((I),(J)) ); maxAlpha = max(maxAlpha, c.a); if (c.a <= 0.0) hasEdge++; }",

                "int hasEdge = 0;",
                "vec4 center = texture2D(tOverlay, vUv);",
                "vec4 selectionPixel = vec4(0.0);",
                "float maxAlpha = 0.0;",
                "bool paintOutline = false;",

                "if (center.a <= 0.0) {",           // if empty pixel, hasEdge counts selection pixels
                    "CHECK_EDGE_ALPHA(-1.0,-1.0);",
                    "CHECK_EDGE_ALPHA( 0.0,-1.0);",
                    "CHECK_EDGE_ALPHA( 1.0,-1.0);",
                    "CHECK_EDGE_ALPHA(-1.0, 0.0);",
                    "CHECK_EDGE_ALPHA( 1.0, 0.0);",
                    "CHECK_EDGE_ALPHA(-1.0, 1.0);",
                    "CHECK_EDGE_ALPHA( 0.0, 1.0);",
                    "CHECK_EDGE_ALPHA( 1.0, 1.0);",
                    "if (hasEdge != 0) {",              // if has selection neighbors
                        "center = selectionPixel;",
                        "paintOutline = true;",
                    "}",
                "}",
                "else if (center.a > 0.0 && IS_SELECTION(center)) {",  // if selection pixel, hasEdge counts alpha pixels
                    "CHECK_EDGE_SELECTION(-1.0,-1.0);",
                    "CHECK_EDGE_SELECTION( 0.0,-1.0);",
                    "CHECK_EDGE_SELECTION( 1.0,-1.0);",
                    "CHECK_EDGE_SELECTION(-1.0, 0.0);",
                    "CHECK_EDGE_SELECTION( 1.0, 0.0);",
                    "CHECK_EDGE_SELECTION(-1.0, 1.0);",
                    "CHECK_EDGE_SELECTION( 0.0, 1.0);",
                    "CHECK_EDGE_SELECTION( 1.0, 1.0);",
                    "if (hasEdge != 0)",                // if has empty neighbors
                        "paintOutline = true;",
                    "else",
                        "center.a = -center.a;",        // special flag marking inside pixel
                "}",

                // calculate outline color
                "if (paintOutline) {",
                    "float maxComponent = max(center.r, max(center.g, center.b));",
                    "center.rgb /= maxComponent;",
                    "center.rgb = sqrt(center.rgb);",
                    "center.a = 0.5 + 0.5 * maxAlpha * 0.125 * float(hasEdge);",
                "}",

                "return center;",
            "}",

            "vec4 sampleColor() {",
                "return texture2D( tDiffuse, vUv );",
            "}",

            "float sampleAO() {",
                // take sqrt to simulate gamma correction
                "return (useAO != 0) ? sqrt(texture2D(tAO, vUv).r) : 1.0;",
            "}",

            "void main() {",

                "vec4 texel = sampleColor();",

    //Tone mapping is currently done by the main forward pass, in order to fit the
    //output into an RGBA8 render target. It's mathematically wrong to apply the
    //ambient obscurance in gamma space, but the performance savings of not using RGBA32 target
    //are significant.
                "texel.rgb *= sampleAO();",//sqrt for gamma correct the AO -- TODO: play with this to see if we get better results
    /*
                "texel.rgb *= ao;",
    
                //Apply tone mapping
                "if (toneMapMethod == 1) {",
                    "vec3 rgb = texel.rgb * exposureBias;",
                    "texel.rgb = toneMapCanonFilmic_WithGamma(rgb);",
                "} else if (toneMapMethod == 2) {",
                    "vec3 rgb = texel.rgb * exposureBias;",
                    "float lum = luminance_pre(rgb);",
                    "float lum2 = toneMapCanonFilmic_NoGamma(lum);",
                    "rgb *= lum2 / lum;",
                    "texel.rgb = rgb;",
                    "texel.rgb = pow(texel.rgb, vec3(1.0/2.2));", //apply gamma, since this tone mapper is done in linear space
                "}",
    */
                //composite in the overlays texture
                "if (useOverlay != 0) {",
                    "vec4 overlay = overlayEdgeDetect(vUv);",
                    // Negative alpha signals the inside overlay condition, as above.
                    "if (overlay.a < 0.0) {",
                        "overlay.a = -overlay.a;",

                        "if (overlay.a >= 0.99) {",
                            //Blend the overlay color with the luminance of the underlying
                            //pixel so that we do not lose detail from any underlying texture map
                            "overlay.a = 0.75;",
                            "texel.rgb = vec3(luminance_post(texel.rgb));",
                        "}",
                    "}",

                    "texel.rgb = mix(texel.rgb, sqrt(overlay.rgb)/*sqrt=gamma*/, overlay.a);",
                "}",

                "if (highlightRange == 0) {",
                    "if (objID != 0) {",

                        "vec4 idAtPixel = texture2D(tID, vUv);",

                        "vec3 idDelta = abs(idAtPixel.rgb - objIDv3.rgb);",
                        "if (max(max(idDelta.r, idDelta.g), idDelta.b) < 1e-3) {",
                            "#ifdef IS_2D",
                            "texel.rgb = mix(texel.rgb, vec3(1.0,1.0,0.0), highlightIntensity * 0.25);",
                            "#else",
                            "texel.rgb += highlightIntensity * 0.2;",
                            "#endif",
                        "}",

                    "}",
                "} else {",
                    "vec4 idAtPixel = texture2D(tID, vUv);",
                    "int dbId = int(idAtPixel.r * 255.0 + idAtPixel.g * 255.0 * 256.0 + idAtPixel.b * 255.0 * 256.0 * 256.0);",
                    "if (dbId >= objIDStart && dbId <= objIDEnd) {",
                        "#ifdef IS_2D",
                        "texel.rgb = mix(texel.rgb, vec3(1.0,1.0,0.0), highlightIntensity * 0.25);",
                        "#else",
                        "texel.rgb += highlightIntensity * 0.2;",
                        "#endif",
                    "}",
                "}",

                "gl_FragColor = texel;",
            "}"

        ].join("\n")

    };

    return BlendShader;
});