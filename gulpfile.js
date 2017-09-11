var path = require('path');
var fs = require('fs');


var mkdirp = require('mkdirp');
var globby = require('globby');
var requirejs = require('requirejs');
var rimraf = require('rimraf');

var gulp = require('gulp');
var babel = require('gulp-babel');



var SourcePaths = ['Source/**/'];
var SourceFiles = ['Source/**/*.js', '!Source/HY.js', '!Source/main.js'];

gulp.task('default', ['build']);

gulp.task('build', ['combine', 'pack']);

gulp.task('combine', function() {
    //创建HY.js文件，所有对象挂载到HY命名空间上
    createHYFile();
});

gulp.task('pack', function() {
    //打包
    requirePack('./Source', 'none', './build/HY.js');
});

gulp.task('babel', function() {
    var stream = gulp.src(['Source/**'])
        .pipe(babel())
        .pipe(gulp.dest('babel'));
    return stream;
});

gulp.task('minify',['combine', 'babel'], function(stream) {
    requirePack('./babel', 'uglify', './build/HY.min.js', true);
})

function createHYFile() {
    var root = 'HY';

    var namespaces = [];
    var namespaceInit = [];
    globby.sync(SourcePaths).forEach(function(_path) {
        _path = path.relative('Source', _path);
        console.log(_path)
        var dirs = _path.split('\\');
        var namespace = root;
        var i = 0;
        dirs.forEach(function(dir) {
            if(dir != '') {
                namespace += '[\'' + dir + '\']';
                var key = dirs.slice(0, i + 1).join('_');
                if(namespaces.indexOf(key) == -1) {
                    namespaces.push(key);
                    namespace += ' = {};';
                    namespaceInit.push(namespace);
                }
            }
            i++;
        })
    });

    var modulePaths = [];
    var moduleNames = [];
    var modules = [];
    globby.sync(SourceFiles).forEach(function(file) {
        file = path.relative('Source', file);
        var isInitFile = file.indexOf('\\Init.js') > -1;
        var module = pathToModule(file);
        var moduleName = module.replace(/[^a-zA-Z1-9]/g, '_');
        var namespace = root;
        var paths = module.split('/');
        paths.forEach(function(_path) {
            namespace += '[\'' + _path + '\']';
        });
        //Init.js文件要先加载
        if(isInitFile) {
            moduleNames.unshift(moduleName);
            modules.unshift(namespace + ' = ' + moduleName + ';');
            modulePaths.unshift('\'./' + module + '\'');
        } else {
            moduleNames.push(moduleName); 
            modules.push(namespace + ' = ' + moduleName + ';');
            modulePaths.push('\'./' + module + '\'');
        }
    });

    var content = 'define([\n'
        + modulePaths.join(',\n')
        + '], function(\n'
        + moduleNames.join(',\n')
        + ') {\n'
        + 'var ' + root + ' = {};\n'
        + namespaceInit.join('\n')
        + '\n' + modules.join('\n')
        + '\nreturn HY;\n'
        + '});'

    fs.writeFileSync(path.join('Source', 'HY.js'), content);
}

function pathToModule(file) {
    return file.substring(0, file.lastIndexOf('.')).replace(/\\/g, '/');
}
function removeExtension(p) {
    return p.slice(0, -path.extname(p).length);
}

function requirePack(baseUrl, optimizer, outputFile, isMinify) {
    // console.log(require.resolve('requirejs'))
    // console.log(removeExtension(path.relative('src', require.resolve('almond'))))
    // ./node_modules/_requirejs@2.3.5@requirejs/bin/r.js
    // ../node_modules/_almond@0.3.3@almond/almond
    requirejs.optimize({
        baseUrl: baseUrl,
        paths: {
            Hammer: '../lib/hammerjs/hammer'
        },
        wrap : true,
        useStrict : true,
        optimize : optimizer,
        optimizeCss : 'standard',
        skipModuleInsertion : true,
        name : removeExtension(path.relative('Source', require.resolve('almond'))),
        include : './main.js',
        out : outputFile
    }, function() {
        if(isMinify) {
            rimraf.sync('./babel/');
        }
        console.log('done');
    })
}