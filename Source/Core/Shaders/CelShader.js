define([
    './Chunks/TonemapShaderChunk'
], function(TonemapShaderChunk) {
    'use strict';

    var CelShader = {

        uniforms: {

            "tDiffuse": { type: "t", value: null },
            "tDepth": { type: "t", value: null },
            "tID": { type: "t", value: null },
            "resolution": { type: "v2", value: new THREE.Vector2(1 / 1024, 1 / 512) },
            "cameraNear": { type: "f", value: 1 },
            "cameraFar": { type: "f", value: 100 },
            "projInfo": { type: "v4", value: new THREE.Vector4(0, 0, 0, 0) },
            "isOrtho": { type: "f", value: 1.0 }
        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "vUv = uv;",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

            "#extension GL_OES_standard_derivatives : enable",

            "uniform sampler2D tDiffuse;",
            "uniform sampler2D tDepth;",
            "uniform sampler2D tID;",
            "uniform vec2 resolution;",
            "uniform float cameraNear;",
            "uniform float cameraFar;",


            "uniform float isOrtho;",
            "uniform vec4 projInfo;",

            "varying vec2 vUv;",

            "vec4 recoverNZ(vec4 nrmz) {",
                "float z = sqrt(1.0 - dot(nrmz.xy, nrmz.xy));",
                "nrmz.w = -(nrmz.z +cameraNear) / (cameraFar - cameraNear);",
                "nrmz.z = z;",
                "return nrmz;",
            "}",

            TonemapShaderChunk,

            "vec4 quantize(vec4 c) {",
                "c *= c;",
                //"float L = luminance_pre(c.xyz);",
                "float L = max(c.x, max(c.y, c.z));",
                "c.xyz *= floor(L * 8.0 + 0.5) / (8.0 * L);",
                "c.w = 1.0;",
                "return sqrt(c);",
            "}",

            "vec4 quantizeRGB(vec4 c) {",
                "c *= c;",
                "c.xyz *= floor(c.xyz * 8.0 + 0.5) / 8.0;",
                "c.w = 1.0;",
                "return sqrt(c);",
            "}",

            "vec3 reconstructCSPosition(vec2 S, float z) {",
                "return vec3((S.xy * projInfo.xy + projInfo.zw) * mix(z, -1.0, isOrtho), z);",
            "}",

            /** Reconstructs screen-space unit normal from screen-space position */
            "vec3 reconstructCSFaceNormal(vec3 C) {",
                "return normalize(cross(dFdy(C), dFdx(C)));",
            "}",

            "vec3 getPosition(ivec2 ssP, float depth) {",
                "vec3 P;",

                // Offset to pixel center
                "P = reconstructCSPosition(vec2(ssP) + vec2(0.5), depth);",
                "return P;",
            "}",

            "int isObjectEdge() {",

                "vec4 MM = texture2D(tID, vUv + vec2( 0.0,  0.0));",

                "vec4 LL = texture2D(tID, vUv + vec2(-1.0, -1.0) * resolution);",
                "if (MM != LL) return 1;",

                "vec4 LM = texture2D(tID, vUv + vec2( 0.0, -1.0) * resolution);",
                "if (MM != LM) return 1;",

                "vec4 LR = texture2D(tID, vUv + vec2( 1.0, -1.0) * resolution);",
                "if (MM != LR) return 1;",

                "vec4 ML = texture2D(tID, vUv + vec2(-1.0,  0.0) * resolution);",
                "if (MM != ML) return 1;",

                "vec4 MR = texture2D(tID, vUv + vec2( 1.0,  0.0) * resolution);",
                "if (MM != MR) return 1;",

                "vec4 UL = texture2D(tID, vUv + vec2(-1.0,  1.0) * resolution);",
                "if (MM != UL) return 1;",

                "vec4 UM = texture2D(tID, vUv + vec2( 0.0,  1.0) * resolution);",
                "if (MM != UM) return 1;",

                "vec4 UR = texture2D(tID, vUv + vec2( 1.0,  1.0) * resolution);",
                "if (MM != UR) return 1;",

                "return 0;",

            "}",

            "float normalDiff(vec3 n1, vec3 n2) {",
                "float d = dot(n1.xyz, n2.xyz);",
                "return acos(clamp(d, -1.0, 1.0));",
            "}",

            "const float r = 1.0;",

            "void main() {",

                "vec4 color = texture2D(tDiffuse, vUv);",

                "ivec2 ssC = ivec2(gl_FragCoord.xy);",

                "if (isObjectEdge() == 1) {",
                    "gl_FragColor = vec4(0,0,0,1);",
                    "return;",
                "}",

                /*
                "else {",
                    "gl_FragColor = vec4(1,1,1,1);",
                    "return;",
                "}",
    
    */
                "vec4 MM = texture2D(tDepth, vUv + vec2( 0.0,  0.0));",

                //Check if it's a background pixel -- there are no edges then.
                //Note that silhouette edges are caught by the earlier check for isObjectEdge.
                "if (MM.z == 0.0) {",
                    "gl_FragColor = quantize(color);",
                    "return;",
                "}",

                "vec4 LL = texture2D(tDepth, vUv + vec2(-r, -r) * resolution);",
                "vec4 LM = texture2D(tDepth, vUv + vec2( 0.0, -r) * resolution);",
                "vec4 LR = texture2D(tDepth, vUv + vec2( r, -r) * resolution);",

                "vec4 ML = texture2D(tDepth, vUv + vec2(-r,  0.0) * resolution);",
                "vec4 MR = texture2D(tDepth, vUv + vec2( r,  0.0) * resolution);",

                "vec4 UL = texture2D(tDepth, vUv + vec2(-r, r) * resolution);",
                "vec4 UM = texture2D(tDepth, vUv + vec2( 0.0,  r) * resolution);",
                "vec4 UR = texture2D(tDepth, vUv + vec2( r,  r) * resolution);",

                "vec3 C = getPosition(ssC + ivec2(-1, -1), LL.z);",
                "vec3 LLz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2( 0, -1), LM.z);",
                "vec3 LMz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2( 1, -1), LR.z);",
                "vec3 LRz = reconstructCSFaceNormal(C);",

                "C = getPosition(ssC + ivec2(-1, 0), ML.z);",
                "vec3 MLz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2( 0, 0), MM.z);",
                "vec3 MMz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2( 1, 0), MR.z);",
                "vec3 MRz = reconstructCSFaceNormal(C);",

                "C = getPosition(ssC + ivec2(-1, 1), UL.z);",
                "vec3 ULz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2(0, 1), UM.z);",
                "vec3 UMz = reconstructCSFaceNormal(C);",
                "C = getPosition(ssC + ivec2(1, 1), UR.z);",
                "vec3 URz = reconstructCSFaceNormal(C);",


                "LL = recoverNZ(LL);",
                "LM = recoverNZ(LM);",
                "LR = recoverNZ(LR);",

                "ML = recoverNZ(ML);",
                "MM = recoverNZ(MM);",
                "MR = recoverNZ(MR);",

                "UL = recoverNZ(UL);",
                "UM = recoverNZ(UM);",
                "UR = recoverNZ(UR);",

                //Angles between the center and surrounding normals 
                "float pLL = normalDiff(LL.xyz, MM.xyz);",
                "float pLM = normalDiff(LM.xyz, MM.xyz);",
                "float pLR = normalDiff(LR.xyz, MM.xyz);",

                "float pML = normalDiff(ML.xyz, MM.xyz);",
                "float pMM = normalDiff(MM.xyz, MM.xyz);",
                "float pMR = normalDiff(MR.xyz, MM.xyz);",

                "float pUL = normalDiff(UL.xyz, MM.xyz);",
                "float pUM = normalDiff(UM.xyz, MM.xyz);",
                "float pUR = normalDiff(UR.xyz, MM.xyz);",

                //Angles between the center and surrounding normals, where normals
                //are computed from depth buffer and projection matrix.

                "float pLLz = normalDiff(LLz.xyz, MMz.xyz);",
                "float pLMz = normalDiff(LMz.xyz, MMz.xyz);",
                "float pLRz = normalDiff(LRz.xyz, MMz.xyz);",

                "float pMLz = normalDiff(MLz.xyz, MMz.xyz);",
                "float pMMz = normalDiff(MMz.xyz, MMz.xyz);",
                "float pMRz = normalDiff(MRz.xyz, MMz.xyz);",

                "float pULz = normalDiff(ULz.xyz, MMz.xyz);",
                "float pUMz = normalDiff(UMz.xyz, MMz.xyz);",
                "float pURz = normalDiff(URz.xyz, MMz.xyz);",

                //Sobel
                //"vec4 G = (UL + 2.0 * UM + UR) - (LL + 2.0 * LM + LR) + (UR + 2.0 * MR - LR) - (UL + 2.0 * ML - LL);",
                //"float Gn = (pUL + 2.0 * pUM + pUR) - (pLL + 2.0 * pLM + pLR) + (pUR + 2.0 * pMR - pLR) - (pUL + 2.0 * pML - pLL);",
                //"float Gnz = (pULz + 2.0 * pUMz + pURz) - (pLLz + 2.0 * pLMz + pLRz) + (pURz + 2.0 * pMRz - pLRz) - (pULz + 2.0 * pMLz - pLLz);",
                "float dGx = (dFdx(UL.w) + 2.0 * dFdx(UM.w) + dFdx(UR.w)) - (dFdx(LL.w) + 2.0 * dFdx(LM.w) + dFdx(LR.w)) + (dFdx(UR.w) + 2.0 * dFdx(MR.w) - dFdx(LR.w)) - (dFdx(UL.w) + 2.0 * dFdx(ML.w) - dFdx(LL.w));",
                "float dGy = (dFdy(UL.w) + 2.0 * dFdy(UM.w) + dFdy(UR.w)) - (dFdy(LL.w) + 2.0 * dFdy(LM.w) + dFdy(LR.w)) + (dFdy(UR.w) + 2.0 * dFdy(MR.w) - dFdy(LR.w)) - (dFdy(UL.w) + 2.0 * dFdy(ML.w) - dFdy(LL.w));",

                //Filter given in Decaudin's 1996 paper
                "float Gn = (abs(pUL - pMM) + 2.0 * abs(pUM - pMM) + abs(pUR - pMM) + 2.0 * abs(pML - pMM) + 2.0 * abs(pMR - pMM) + abs(pLL - pMM) + 2.0 * abs(pLM - pMM) + abs(pLR - pMM));",
                "float Gnz = (abs(pULz - pMMz) + 2.0 * abs(pUMz - pMMz) + abs(pURz - pMMz) + 2.0 * abs(pMLz - pMMz) + 2.0 * abs(pMRz - pMMz) + abs(pLLz - pMMz) + 2.0 * abs(pLMz - pMMz) + abs(pLRz - pMMz));",
                "float G = (abs(UL.w - MM.w) + 2.0 * abs(UM.w - MM.w) + abs(UR.w - MM.w) + 2.0 * abs(ML.w - MM.w) + 2.0 * abs(MR.w - MM.w) + abs(LL.w - MM.w) + 2.0 * abs(LM.w - MM.w) + abs(LR.w - MM.w));",

                "float dd = abs(dFdx(G)) + abs(dFdy(G));",
                //"float dd = abs(dGx) + abs(dGy);",

                "if (dd > 0.004 || abs(Gnz) > 2.2 || abs(Gn) > 2.0)",
                        "gl_FragColor = vec4(0.0,0.0,0.0,1.0);",
                "else",
                    "gl_FragColor = /*vec4(1.0,1.0,1.0,1.0);*/quantize(color);",

            "}"

        ].join("\n")

    };

    return CelShader;
});