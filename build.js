

({
    baseUrl: './babel',
    paths: {
        Hammer: '../lib/hammerjs/hammer'
    },
    wrap : true,
    useStrict : true,
    optimize : 'uglify',
    optimizeCss : 'standard',
    pragmas : {
        debug : true
    },
    skipModuleInsertion : true,
    name : '../node_modules/_almond@0.3.3@almond/almond',
    include : './main.js',
    out : './build/HY.min.js',
  })