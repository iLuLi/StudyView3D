define([
    '../DeviceType',
    './PrismMaps',
    '../Logger',
    './Global',
    './FireflyWebGLShader'
], function(DeviceType, PrismMaps, Logger, Privite_Global, FireflyWebGLShader) {
    'use strict';

    //Based on THREE.WebGLProgram, with some defines added / removed.
    var programIdCount = 0;

    var generateDefines = function (defines) {

        var value, chunk, chunks = [];

        for (var d in defines) {

            value = defines[d];
            if (value === false) continue;

            chunk = "#define " + d + " " + value;
            chunks.push(chunk);

        }

        return chunks.join("\n");

    };

    var cacheUniformLocations = function (gl, program, identifiers) {

        var uniforms = {};

        for (var i = 0, l = identifiers.length; i < l; i++) {

            var id = identifiers[i];
            uniforms[id] = gl.getUniformLocation(program, id);

        }

        return uniforms;

    };

    var cacheAttributeLocations = function (gl, program, identifiers) {

        var attributes = {};

        for (var i = 0, l = identifiers.length; i < l; i++) {

            var id = identifiers[i];
            attributes[id] = gl.getAttribLocation(program, id);

        }

        return attributes;

    };

    // Add clamping and inversion code for the simple Phong material perform any operations needed.
    // This is done here because we have access to the clamp and inversion parameters. The macro #defined
    // by this method can then be used elsewhere without knowledge of these parameters.
    var getMapChunk = function (name, clampS, clampT, invert, emptyChunk) {
        var invertChunk = invert ? "1.0-" : "";
        var readChunk = "texture2D(" + name + ", (UV))";
        var conditionChunk = "";
        emptyChunk = emptyChunk || "vec4(0.0)";
        if (clampS && clampT)
            conditionChunk = "((UV).x < 0.0 || (UV).x > 1.0 || (UV).y < 0.0 || (UV).y > 1.0) ? " + emptyChunk + " : ";
        else if (clampS)
            conditionChunk = "((UV).x < 0.0 || (UV).x > 1.0) ? " + emptyChunk + " : ";
        else if (clampT)
            conditionChunk = "((UV).y < 0.0 || (UV).y > 1.0) ? " + emptyChunk + " : ";
        return "#define GET_" + name.toUpperCase() + "(UV) (" + conditionChunk + invertChunk + readChunk + ")";
    };

    // We test if the UVs are in the bounds when clamping; if not, discard!
    // This is done here because we have access to the clamp parameters. The macro #defined
    // by this method can then be used elsewhere, e.g. GetPrismMapSampleChunk, without knowledge of these parameters.
    // Here is a typical result returned when clamping is on and "opaque_albedo" is passed in for the name:
    // #define OPAQUE_ALBEDO_CLAMP_TEST if (uv_opaque_albedo_map.x < 0.0 || uv_opaque_albedo_map.x > 1.0 || uv_opaque_albedo_map.y < 0.0 || uv_opaque_albedo_map.y > 1.0) { discard; }
    var getPrismMapChunk = function (name, clampS, clampT) {
        var uv = "uv_" + name + "_map";
        var conditionChunk = "";
        if (clampS && clampT)
            conditionChunk = "if (" + uv + ".x < 0.0 || " + uv + ".x > 1.0 || " + uv + ".y < 0.0 || " + uv + ".y > 1.0) { discard; }";
        else if (clampS)
            conditionChunk = "if (" + uv + ".x < 0.0 || " + uv + ".x > 1.0) { discard; }";
        else if (clampT)
            conditionChunk = "if (" + uv + ".y < 0.0 || " + uv + ".y > 1.0) { discard; }";
        return "#define " + name.toUpperCase() + "_CLAMP_TEST " + conditionChunk;
    };

    var getPrismMapsChunk = function (parameters) {

        var result = "\n";

        for (var i = 0; i < PrismMaps.length; i++) {
            var val = parameters[PrismMaps[i]];
            if (val)
                result += getPrismMapChunk(PrismMaps[i], val.S, val.T) + "\n";
        }

        return result;
    };

    return function (renderer, code, material, parameters) {

        var _this = renderer;
        var _gl = _this.context;

        var defines = material.defines;
        var uniforms = material.__webglShader.uniforms;
        var attributes = material.attributes;

        var vertexShader = material.__webglShader.vertexShader;
        var fragmentShader = material.__webglShader.fragmentShader;

        var index0AttributeName = material.index0AttributeName;

        if (index0AttributeName === undefined && parameters.morphTargets === true) {

            // programs with morphTargets displace position out of attribute 0

            index0AttributeName = 'position';

        }

        var shadowMapTypeDefine = "SHADOWMAP_TYPE_BASIC";

        if (parameters.shadowMapType === THREE.PCFShadowMap) {

            shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF";

        } else if (parameters.shadowMapType === THREE.PCFSoftShadowMap) {

            shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF_SOFT";

        }

        var envMapTypeDefine = 'ENVMAP_TYPE_CUBE';
        var envMapModeDefine = 'ENVMAP_MODE_REFLECTION';
        var envMapBlendingDefine = 'ENVMAP_BLENDING_MULTIPLY';

        if (parameters.envMap) {
            //This will make more sense when we update three.js to R70
            //Currently we don't need any of it anyway, because we only
            //reflect and use cube maps.
            /*
                        switch ( material.envMap.mapping ) {
            
                            case THREE.CubeReflectionMapping:
                            case THREE.CubeRefractionMapping:
                                envMapTypeDefine = 'ENVMAP_TYPE_CUBE';
                                break;
            
                            case THREE.EquirectangularReflectionMapping:
                            case THREE.EquirectangularRefractionMapping:
                                envMapTypeDefine = 'ENVMAP_TYPE_EQUIREC';
                                break;
            
                            case THREE.SphericalReflectionMapping:
                                envMapTypeDefine = 'ENVMAP_TYPE_SPHERE';
                                break;
            
                        }
            
                        switch ( material.envMap.mapping ) {
            
                            case THREE.CubeRefractionMapping:
                            case THREE.EquirectangularRefractionMapping:
                                envMapModeDefine = 'ENVMAP_MODE_REFRACTION';
                                break;
            
                        }
            
            
                        switch ( material.combine ) {
            
                            case THREE.MultiplyOperation:
                                envMapBlendingDefine = 'ENVMAP_BLENDING_MULTIPLY';
                                break;
            
                            case THREE.MixOperation:
                                envMapBlendingDefine = 'ENVMAP_BLENDING_MIX';
                                break;
            
                            case THREE.AddOperation:
                                envMapBlendingDefine = 'ENVMAP_BLENDING_ADD';
                                break;
            
                        }
            */
        }

        var gammaFactorDefine = (renderer.gammaFactor > 0) ? renderer.gammaFactor : 1.0;

        // Logger.log( "building new program " );

        //

        var customDefines = generateDefines(defines);

        //

        var program = _gl.createProgram();

        var prefix_vertex, prefix_fragment;

        if (material instanceof THREE.RawShaderMaterial) {

            prefix_vertex = '';
            prefix_fragment = '';

        } else {

            prefix_vertex = [

				"precision " + parameters.precision + " float;",
				"precision " + parameters.precision + " int;",

				customDefines,

				parameters.supportsVertexTextures ? "#define VERTEX_TEXTURES" : "",

				_this.gammaInput ? "#define GAMMA_INPUT" : "",
				_this.gammaOutput ? "#define GAMMA_OUTPUT" : "",
				'#define GAMMA_FACTOR ' + gammaFactorDefine,

				parameters.mrtNormals ? "#define MRT_NORMALS" : "", //FY
				parameters.mrtIdBuffer ? "#define MRT_ID_BUFFER" : "", //FY

				"#define MAX_DIR_LIGHTS " + parameters.maxDirLights,
				"#define MAX_POINT_LIGHTS " + parameters.maxPointLights,
				"#define MAX_SPOT_LIGHTS " + parameters.maxSpotLights,
				"#define MAX_HEMI_LIGHTS " + parameters.maxHemiLights,

				"#define MAX_SHADOWS " + parameters.maxShadows,

				"#define MAX_BONES " + parameters.maxBones,

				"#define NUM_CUTPLANES " + parameters.numCutplanes,

				parameters.map ? "#define USE_MAP" : "",
				parameters.envMap ? "#define USE_ENVMAP" : "",
				parameters.envMap ? '#define ' + envMapModeDefine : '',
				parameters.irradianceMap ? "#define USE_IRRADIANCEMAP" : "", //FY
				parameters.lightMap ? "#define USE_LIGHTMAP" : "",
				parameters.bumpMap ? "#define USE_BUMPMAP" : "",
				parameters.normalMap ? "#define USE_NORMALMAP" : "",
				parameters.specularMap ? "#define USE_SPECULARMAP" : "",
				parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
				parameters.vertexColors ? "#define USE_COLOR" : "",

				parameters.skinning ? "#define USE_SKINNING" : "",
				parameters.useVertexTexture ? "#define BONE_TEXTURE" : "",

				parameters.morphTargets ? "#define USE_MORPHTARGETS" : "",
				parameters.morphNormals ? "#define USE_MORPHNORMALS" : "",
				parameters.wrapAround ? "#define WRAP_AROUND" : "",
				parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
				parameters.flipSided ? "#define FLIP_SIDED" : "",

				parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
				parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
				parameters.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "",
				parameters.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "",

				parameters.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",

				parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
				parameters.useFragDepthExt ? "#define USE_LOGDEPTHBUF_EXT" : "",

				parameters.packedNormals ? "#define UNPACK_NORMALS" : "",

				// "#define FLAT_SHADED",  // TODO_NOP: hook up to param

				"uniform mat4 modelMatrix;",
				"uniform mat4 modelViewMatrix;",
				"uniform mat4 projectionMatrix;",
				"uniform mat4 viewMatrix;",
				"uniform mat3 normalMatrix;",
				"uniform vec3 cameraPosition;",

				"attribute vec3 position;",

				"#ifdef UNPACK_NORMALS",
					"attribute vec2 normal;",
				"#else",
					"attribute vec3 normal;",
				"#endif",

				"attribute vec2 uv;",
				"attribute vec2 uv2;",

				"#ifdef PRISMWOOD",
					"attribute vec3 uvw;",
				"#endif",

				"#ifdef USE_COLOR",

				"	attribute vec3 color;",

				"#endif",

				""

            ].join('\n');

            prefix_fragment = [
				(parameters.bumpMap || parameters.normalMap) ? "#extension GL_OES_standard_derivatives : enable" : "",
				((parameters.mrtIdBuffer || parameters.mrtNormals) && (!DeviceType.isIE11)) ? "#extension GL_EXT_draw_buffers : enable" : "",
				parameters.mrtIdBuffer ? "#define gl_FragColor gl_FragData[0]" : "",

                parameters.haveTextureLod ? "#define HAVE_TEXTURE_LOD" : "",

				customDefines,

				"#define MAX_DIR_LIGHTS " + parameters.maxDirLights,
				"#define MAX_POINT_LIGHTS " + parameters.maxPointLights,
				"#define MAX_SPOT_LIGHTS " + parameters.maxSpotLights,
				"#define MAX_HEMI_LIGHTS " + parameters.maxHemiLights,

				"#define MAX_SHADOWS " + parameters.maxShadows,

				"#define NUM_CUTPLANES " + parameters.numCutplanes,

				parameters.alphaTest ? "#define ALPHATEST " + parameters.alphaTest : "",

				_this.gammaInput ? "#define GAMMA_INPUT" : "",
				_this.gammaOutput ? "#define GAMMA_OUTPUT" : "",
				'#define GAMMA_FACTOR ' + gammaFactorDefine,

				parameters.mrtNormals ? "#define MRT_NORMALS" : "", //FY
				parameters.mrtIdBuffer ? "#define MRT_ID_BUFFER" : "", //FY
				parameters.mrtIdBuffer > 1 ? "#define MODEL_COLOR" : "",

				'#define TONEMAP_OUTPUT ' + (parameters.tonemapOutput || 0),

				(parameters.useFog && parameters.fog) ? "#define USE_FOG" : "",
				(parameters.useFog && parameters.fogExp) ? "#define FOG_EXP2" : "",

				parameters.map ? "#define USE_MAP" : "",
				parameters.envMap ? "#define USE_ENVMAP" : "",
				parameters.envMap ? '#define ' + envMapTypeDefine : '',
				parameters.envMap ? '#define ' + envMapModeDefine : '',
				parameters.envMap ? '#define ' + envMapBlendingDefine : '',
				parameters.irradianceMap ? "#define USE_IRRADIANCEMAP" : "", //FY
				parameters.envGammaEncoded ? "#define ENV_GAMMA" : "", //FY
				parameters.irrGammaEncoded ? "#define IRR_GAMMA" : "", //FY
				parameters.envRGBM ? "#define ENV_RGBM" : "", //FY
				parameters.irrRGBM ? "#define IRR_RGBM" : "", //FY
				parameters.lightMap ? "#define USE_LIGHTMAP" : "",
				parameters.bumpMap ? "#define USE_BUMPMAP" : "",
				parameters.normalMap ? "#define USE_NORMALMAP" : "",
				parameters.specularMap ? "#define USE_SPECULARMAP" : "",
				parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
				parameters.vertexColors ? "#define USE_COLOR" : "",

				parameters.metal ? "#define METAL" : "",
				parameters.clearcoat ? "#define CLEARCOAT" : "",
				parameters.wrapAround ? "#define WRAP_AROUND" : "",
				parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
				parameters.flipSided ? "#define FLIP_SIDED" : "",

				parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
				parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
				parameters.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "",
				parameters.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "",

				parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
				//parameters.useFragDepthExt ? "#define USE_LOGDEPTHBUF_EXT" : "",

				parameters.hatchPattern ? "#define HATCH_PATTERN" : "",

				parameters.mapInvert ? "#define MAP_INVERT" : "",
				getMapChunk("map", parameters.mapClampS, parameters.mapClampT),
				getMapChunk("bumpMap", parameters.bumpMapClampS, parameters.bumpMapClampT),
				getMapChunk("normalMap", parameters.normalMapClampS, parameters.normalMapClampT),
				getMapChunk("specularMap", parameters.specularMapClampS, parameters.specularMapClampT),
				getMapChunk("alphaMap", parameters.alphaMapClampS, parameters.alphaMapClampT, parameters.alphaMapInvert),

				// "#define FLAT_SHADED",  // TODO_NOP: hook up to param

				"#ifdef USE_ENVMAP",
				"#ifdef HAVE_TEXTURE_LOD",
				"#extension GL_EXT_shader_texture_lod : enable",
				"#endif",
				'#endif',

				"#extension GL_OES_standard_derivatives : enable",

				"precision " + parameters.precisionFragment + " float;",
				"precision " + parameters.precisionFragment + " int;",

				"uniform highp mat4 viewMatrix;",
				"uniform highp mat4 projectionMatrix;",
				"uniform highp vec3 cameraPosition;",

	            "#ifdef USE_ENVMAP",

                	"uniform mat4 viewMatrixInverse;",

            	"#endif",

				""
            ].join('\n');

            // now get map chunks for PRISM material
            // mapPrismOpaqueLuminanceModifierClampS etc. are set in FireflyWebGLRenderer.js in the parameters
            if (parameters.isPrism)
                prefix_fragment += getPrismMapsChunk(parameters);

        }

        var glVertexShader = new FireflyWebGLShader(_gl, _gl.VERTEX_SHADER, prefix_vertex + vertexShader);
        var glFragmentShader = new FireflyWebGLShader(_gl, _gl.FRAGMENT_SHADER, prefix_fragment + fragmentShader);

        _gl.attachShader(program, glVertexShader);
        _gl.attachShader(program, glFragmentShader);

        if (index0AttributeName !== undefined) {

            // Force a particular attribute to index 0.
            // because potentially expensive emulation is done by browser if attribute 0 is disabled.
            // And, color, for example is often automatically bound to index 0 so disabling it

            _gl.bindAttribLocation(program, 0, index0AttributeName);

        }

        _gl.linkProgram(program);

        if (Privite_Global.DEBUG_SHADERS) {

            if (_gl.getProgramParameter(program, _gl.LINK_STATUS) === false) {

                Logger.error('THREE.WebGLProgram: Could not initialise shader.');
                Logger.error('gl.VALIDATE_STATUS', _gl.getProgramParameter(program, _gl.VALIDATE_STATUS));
                Logger.error('gl.getError()', _gl.getError());

            }

            if (_gl.getProgramInfoLog(program) !== '') {

                Logger.warn('THREE.WebGLProgram: gl.getProgramInfoLog()', _gl.getProgramInfoLog(program));

            }

        }

        // clean up

        _gl.deleteShader(glVertexShader);
        _gl.deleteShader(glFragmentShader);

        // cache uniform locations

        var identifiers = [

			'viewMatrix', 'modelViewMatrix', 'projectionMatrix', 'normalMatrix', 'modelMatrix', 'cameraPosition',
			'viewMatrixInverse', 'mvpMatrix', 'dbId'//FY

        ];

        if (parameters.logarithmicDepthBuffer) {

            identifiers.push('logDepthBufFC');

        }


        for (var u in uniforms) {

            identifiers.push(u);

        }

        this.uniforms = cacheUniformLocations(_gl, program, identifiers);

        // cache attributes locations

        identifiers = [

			"position", "normal", "uv", "uv2", "tangent", "color",
			"lineDistance", "uvw"

        ];

        for (var a in attributes) {

            identifiers.push(a);

        }

        this.attributes = cacheAttributeLocations(_gl, program, identifiers);
        this.attributesKeys = Object.keys(this.attributes);

        //

        this.id = programIdCount++;
        this.code = code;
        this.usedTimes = 1;
        this.program = program;
        this.vertexShader = glVertexShader;
        this.fragmentShader = glFragmentShader;

        return this;

    };

});