define( function() {
    'use strict';
    return {
        uniforms: {
            tDiffuse: { type: "t", value: null },
            uColor: { type: "v4", value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }
        },

        // defines: {
        //     KERNEL_SCALE_H:  1.0 / 64.0,
        //     KERNEL_SCALE_V:  1.0 / 64.0,
        //     KERNEL_RADIUS: 7.0
        // },

        vertexShader: [
            "varying vec2 vUv;",

            "void main() {",
            "#if defined(HORIZONTAL) && defined(FLIP_UV)",
            "    vUv = vec2(uv.x, 1.0-uv.y);",
            "#else",
            "    vUv = vec2(uv.x, uv.y);",
            "#endif",
            "    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}",
        ].join("\n"),

        fragmentShader: [
            "uniform sampler2D tDiffuse;",
            "uniform vec4 uColor;",
            "varying vec2 vUv;",
            "#ifdef HORIZONTAL",
            "    #define GET_UV(X) vec2(vUv.x + KERNEL_SCALE_H*(X), vUv.y)",
            "#else",
            "    #define GET_UV(Y) vec2(vUv.x, vUv.y + KERNEL_SCALE_V*(Y))",
            "#endif",
            "#define PI 3.14159265358979",
            "#define SIGMA ((KERNEL_RADIUS+KERNEL_RADIUS+1.0) / 6.0)",
            "#define SIGMASQ2 (2.0 * SIGMA * SIGMA)",
            "#define GAUSSIAN(X) ( (1.0 / sqrt(PI * SIGMASQ2)) * exp(-(X)*(X)/SIGMASQ2) )",
            "void main() {",
            "    vec4 texColSum = vec4(0.0);",
            "    float gaussSum = 0.0;",
            "    for (float x=-KERNEL_RADIUS; x<=KERNEL_RADIUS; x+=1.0) {",
            "        float gauss = GAUSSIAN(x);",
            "        vec4 texCol = texture2D(tDiffuse, GET_UV(x));",
            "        #ifdef HAS_ALPHA",
            "            texCol.rgb *= texCol.a;",
            "        #endif",
            "        texColSum += texCol * gauss;",
            "        gaussSum += gauss;",
            "    }",
            "    #ifdef HAS_ALPHA",
            "        texColSum.rgb /= (texColSum.a == 0.0 ? 0.0001 : texColSum.a);",
            "    #endif",
            "#ifdef HORIZONTAL",
            "    gl_FragColor = texColSum/gaussSum;",
            "#else",
            "    gl_FragColor = texColSum/gaussSum * uColor;",
            "#endif",
            "}",
        ].join("\n")
    };
});