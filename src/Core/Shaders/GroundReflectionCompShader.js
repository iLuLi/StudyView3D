define(function() {;
    'use strict'
    return {
        uniforms: {
            tDiffuse: { type: "t", value: null },
            tBackground: { type: "t", value: null },
            uColor: { type: "v4", value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) }
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
            "uniform sampler2D tBackground;",
            "uniform vec4 uColor;",
            "varying vec2 vUv;",
            "void main() {",
                "vec4 bgCol = texture2D( tBackground, vUv );",
                "vec4 diffCol = uColor * texture2D( tDiffuse, vUv );",
                "gl_FragColor = mix(bgCol, diffCol, diffCol.a);",
            "}"
        ].join("\n")
    };
});