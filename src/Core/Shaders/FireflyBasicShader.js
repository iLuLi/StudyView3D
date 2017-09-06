define([
    './Uniforms/CutPlanesUniforms',
    './Uniforms/IdUniforms',
    './Uniforms/ThemingUniform',
    './Chunks/CutPlanesShaderChunk',
    './Declarations/IdFragmentDeclaration',
    './Declarations/ThemingFragmentDeclaration',
    './Chunks/ThemingFragmentShaderChunk',
    './Chunks/FinalOutputShaderChunk'
], function(
    CutPlanesUniforms,
    IdUniforms,
    ThemingUniform,
    CutPlanesShaderChunk,
    IdFragmentDeclaration,
    ThemingFragmentDeclaration,
    ThemingFragmentShaderChunk,
    FinalOutputShaderChunk,
) {;
    'use strict'
    //Replacement for the THREE BasicMaterial adding
    //cut plane support

    
    var FireflyBasicShader = {

        uniforms: THREE.UniformsUtils.merge([

            THREE.UniformsLib["common"],
            THREE.UniformsLib["fog"],
            THREE.UniformsLib["shadowmap"],
            CutPlanesUniforms,
            IdUniforms,
            ThemingUniform
        ]),

        vertexShader: [

            THREE.ShaderChunk["common"],
            THREE.ShaderChunk["map_pars_vertex"],
            THREE.ShaderChunk["lightmap_pars_vertex"],
            THREE.ShaderChunk["envmap_pars_vertex"],
            THREE.ShaderChunk["color_pars_vertex"],
            THREE.ShaderChunk["morphtarget_pars_vertex"],
            THREE.ShaderChunk["skinning_pars_vertex"],
            THREE.ShaderChunk["shadowmap_pars_vertex"],
            THREE.ShaderChunk["logdepthbuf_pars_vertex"],

            "#if NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",

            "void main() {",

                THREE.ShaderChunk["map_vertex"],
                THREE.ShaderChunk["lightmap_vertex"],
                THREE.ShaderChunk["color_vertex"],
                THREE.ShaderChunk["skinbase_vertex"],

            "	#ifdef USE_ENVMAP",

                THREE.ShaderChunk["morphnormal_vertex"],
                THREE.ShaderChunk["skinnormal_vertex"],
                THREE.ShaderChunk["defaultnormal_vertex"],

            "	#endif",

                THREE.ShaderChunk["morphtarget_vertex"],
                THREE.ShaderChunk["skinning_vertex"],
                THREE.ShaderChunk["default_vertex"],
                THREE.ShaderChunk["logdepthbuf_vertex"],

                THREE.ShaderChunk["worldpos_vertex"],

                "#if NUM_CUTPLANES > 0",
                    "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
                    "vWorldPosition = worldPosition.xyz;",
                "#endif",

                THREE.ShaderChunk["envmap_vertex"],
                THREE.ShaderChunk["shadowmap_vertex"],

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform vec3 diffuse;",
            "uniform float opacity;",

            THREE.ShaderChunk["common"],
            THREE.ShaderChunk["color_pars_fragment"],
            THREE.ShaderChunk["map_pars_fragment"],
            THREE.ShaderChunk["alphamap_pars_fragment"],
            THREE.ShaderChunk["lightmap_pars_fragment"],
            THREE.ShaderChunk["envmap_pars_fragment"],
            THREE.ShaderChunk["fog_pars_fragment"],
            THREE.ShaderChunk["shadowmap_pars_fragment"],
            THREE.ShaderChunk["specularmap_pars_fragment"],
            THREE.ShaderChunk["logdepthbuf_pars_fragment"],

            "#if NUM_CUTPLANES > 0",
                "varying highp vec3 vWorldPosition;",
            "#endif",

            CutPlanesShaderChunk,
            IdFragmentDeclaration,
            ThemingFragmentDeclaration,

            "void main() {",

                "#if NUM_CUTPLANES > 0",
                    "checkCutPlanes(vWorldPosition);",
                "#endif",

            "	vec3 outgoingLight = vec3( 0.0 );",	// outgoing light does not have an alpha, the surface does
            "	vec4 diffuseColor = vec4( diffuse, opacity );",

                THREE.ShaderChunk["logdepthbuf_fragment"],
                THREE.ShaderChunk["map_fragment"],
                THREE.ShaderChunk["color_fragment"],
                THREE.ShaderChunk["alphamap_fragment"],
                THREE.ShaderChunk["alphatest_fragment"],
                THREE.ShaderChunk["specularmap_fragment"],

            "	outgoingLight = diffuseColor.rgb;", // simple shader

                THREE.ShaderChunk["lightmap_fragment"],		// TODO: Light map on an otherwise unlit surface doesn't make sense.
                THREE.ShaderChunk["envmap_fragment"],
                THREE.ShaderChunk["shadowmap_fragment"],		// TODO: Shadows on an otherwise unlit surface doesn't make sense.

                THREE.ShaderChunk["linear_to_gamma_fragment"],

                THREE.ShaderChunk["fog_fragment"],

            "	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",	// TODO, this should be pre-multiplied to allow for bright highlights on very transparent objects

                ThemingFragmentShaderChunk,

                FinalOutputShaderChunk,
            "}"

        ].join("\n")

    };

    THREE.ShaderLib['firefly_basic'] = FireflyBasicShader;
    return FireflyBasicShader;
            
});