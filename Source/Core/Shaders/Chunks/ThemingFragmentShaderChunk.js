define(function() {;
    'use strict'
    return [
        "gl_FragColor.rgb = mix(gl_FragColor.rgb, themingColor.rgb, themingColor.a);"
    ].join("\n");
});