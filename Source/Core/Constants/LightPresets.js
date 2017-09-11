define([
    './BackgroundPresets',
    './DebugEnvironments',
    './Global'
], function(bg, DebugEnvironments, Privite_Global) {
    'use strict';
    var LightPresets = [
        //Notes: tonemap = which tone map method to use. Any tonemap method other than zero will cause colors to be linearized before use.
        //              0 = None, 1 = Prism Cannon-Lum (color preserving), 2 = OGC Cannon RGB (non-color preserving)
        //       exposure = exponential bias to use as pre-tonemap multiplier for all rendered colors, including background
        //       lightMultiplier = linear scale of direct light intensity (diffuse only, not ambient)
        //       bgColorGradient = which background color preset to use as default for the environment map
        //       illuminance     = cosine-weighted integral of the upper-hemisphere (i.e., actual lux)

        //Image-based lighting from RaaS. Initial exposure is empirically obtained.
        //These do not normally require any extra lights, because they have the lights fully baked into
        //the environment maps.

        //Simple ***non-HDR*** environment.
        {
            name: "Simple Grey",    // localized in viewer-environments.loc.json
            path: null,
            tonemap: 0,
            E_bias: 0,
            directLightColor: [1.0, 0.84, 0.67],
            ambientColor: [0.8, 0.9, 1.0],
            lightMultiplier: 1.0,
            bgColorGradient: bg["Fusion Grey"],
            darkerFade: false,
            rotation: 0.0
        },

        //Fusion Environments which require extra lights

        // The E_bias value for the Fusion render-space environments is setup such that
        // the default values match the preset values of brightness (in lux) and EV.
        // The EV value from Fusion follows the Canon standard for luminance and middle-gray
        // https://en.wikipedia.org/wiki/Exposure_value#EV_as_a_measure_of_luminance_and_illuminance [September 2015]
        //
        // Rationale (using the canon tonemap as a guide, based on documentation by Adam Arbree):
        // 1. BaseExposure (B) in the canon tonemap is the negative log2 luminance of the
        //    white point (W) so B = -log2(W)
        // 2. To match the target illuminance from Fusion, the environment needs
        //    to be scaled by the ratio between the target and its actual illuminance, thus
        //    S = target_illuminance / actual_illuminance
        // 3. Then by the definition of middle grey W = L / (0.18*S) where L is the middle grey
        //    luminance and 0.18 is the standard reflection of middle grey.
        // 4. As per the Wikipedia entry, we have L = 2^(EV-3)
        // 5. Putting this all together we have
        //      B = -log2( 2^(EV-3) / (0.18*S)) 
        //        = log2(0.18) + log2(S) – (EV – 3)
        //        = (3+log2(0.18)) – EV + log2(S)
        //        = 0.526069 – EV + log2(S)

        {
            name: "Sharp Highlights",    // localized in viewer-environments.loc.json
            path: "SharpHighlights",
            type: "logluv",
            tonemap: 1,
            // illuminance currently is not used elsewhere in LMV, its effect is folded into E_bias.
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [0.5, 0.5, 0.5],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [0.5, -0.2, -0.06], //world space, not view space!
            bgColorGradient: bg["Photo Booth"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Dark Sky",     // "Dark Sky", localized in viewer-environments.loc.json
            path: "DarkSky",
            type: "logluv",
            tonemap: 1,
            E_bias: -1,
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8], //0.25 with gain of 0.125
            lightMultiplier: 1.0,
            lightDirection: [0.1, -0.55, -1.0],
            bgColorGradient: bg["Dark Sky"],
            darkerFade: false,
            rotation: 0.0
        },

        {
            name: "Grey Room",    // "Grey Room", localized in viewer-environments.loc.json
            path: "GreyRoom",
            type: "logluv",
            tonemap: 1,
            E_bias: -1,
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.5,
            lightDirection: [0.1, -0.55, -1.0],
            bgColorGradient: bg["Grey Room"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Photo Booth",     // "Photo Booth", localized in viewer-environments.loc.json
            path: "PhotoBooth",
            type: "logluv",
            tonemap: 1,
            E_bias: 0,
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.5,
            lightDirection: [0.1, -0.55, -1.0],
            bgColorGradient: bg["Photo Booth"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Tranquility",     // "Tranquility", localized in viewer-environments.loc.json
            path: "TranquilityBlue",
            type: "logluv",
            tonemap: 1,
            E_bias: -1,
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.5,
            lightDirection: [0.1, -0.55, -1.0],
            bgColorGradient: bg["Tranquility"],
            darkerFade: false,
            rotation: 0.0
        },

        {
            name: "Infinity Pool",     // "Infinity Pool", localized in viewer-environments.loc.json
            path: "InfinityPool",
            type: "logluv",
            tonemap: 1,
            E_bias: -1,
            directLightColor: [1.0, 0.84, 0.67],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.5,
            lightDirection: [0.1, -0.55, -1.0],
            bgColorGradient: bg["Infinity Pool"],
            darkerFade: false,
            rotation: 0.0
        },

        // Non fusion environments

        //White background, no HDR -- for cases like SIM360 models
        {
            name: "Simple White",     //"Simple White", localized in viewer-environments.loc.json
            path: null,
            tonemap: 0,
            E_bias: 0,
            directLightColor: [1, 1, 1],
            ambientColor: [0.9, 0.9, 0.9],
            lightMultiplier: 1.0,
            bgColorGradient: bg["White"],
            saoRadius: 0.06,
            saoIntensity: 0.15,
            darkerFade: true,
            rotation: 0.0
        },
/*
        {
            name: "Simple Black",
            path:null,
            tonemap:0,
            E_bias:0,
            directLightColor: [1.0, 0.84, 0.67],
            ambientColor:     [0.8, 0.9,  1.0],
            lightMultiplier: 1.0,
            bgColorGradient: bg["AutoCADModel"],
            darkerFade: false
        },
  */
        //RaaS environments
        {
            name: "Riverbank",     // "Riverbank", localized in viewer-environments.loc.json
            path: "riverbank",
            type: "logluv",
            tonemap: 1,
            E_bias: -5.7,
            directLightColor: [1, 1, 1],
            lightMultiplier: 0.0,
            bgColorGradient: bg["Sky Blue"],
            darkerFade: false,
            rotation: 0.0
        },

        {
            name: "Contrast",     // "Contrast", localized in viewer-environments.loc.json
            path: "IDViz",
            type: "logluv",
            tonemap: 1,
            E_bias: 0,
            directLightColor: [1, 1, 1],
            lightMultiplier: 0.0,
            bgColorGradient: bg["Midnight"],
            darkerFade: false,
            rotation: 0.0
        },

        {
            name: "Rim Highlights",     //  localized in viewer-environments.loc.json
            path: "RimHighlights",
            type: "logluv",
            tonemap: 1,
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [0.5, 0.5, 0.5],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [0.35, -0.35, -0.5], //world space, not view space!
            bgColorGradient: bg["Photo Booth"],
            darkerFade: true,
            rotation: 0.0
        },
        {
            name: "Cool Light",     // "Cool Light", localized in viewer-environments.loc.json
            path: "CoolLight",
            type: "logluv",
            tonemap: 1,
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [-0.0, -0.15, -0.5],
            bgColorGradient: bg["Fusion Grey"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Warm Light",     // "Warm Light", localized in viewer-environments.loc.json
            path: "WarmLight",
            type: "logluv",
            tonemap: 1,
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [-0.0, -0.15, -0.5], //world space, not view space!
            bgColorGradient: bg["Fusion Grey"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Soft Light",     // "Soft Light", localized in viewer-environments.loc.json
            path: "SoftLight",
            type: "logluv",
            tonemap: 1,
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [-0.5, -0.5, 0.0],
            bgColorGradient: bg["Fusion Grey"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Grid Light",     // "Grid Light", localized in viewer-environments.loc.json
            path: "GridLight",
            type: "logluv",
            tonemap: 1,
            //illuminance: 1000.0,
            E_bias: -9.0, // EV 9.526, 1000.0 lux (target)
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0,
            //lightDirection: [-0.5, -0.6, 0.0],
            bgColorGradient: bg["Fusion Grey"],
            darkerFade: true,
            rotation: 0.0
        },

        {
            name: "Plaza",             //  "Plaza", localized in viewer-environments.loc.json
            path: "Plaza",
            type: "logluv",
            tonemap: 1,
            //illuminance: 24157.736,
            E_bias: -14.0, // FIXME: EV 14.526, 50000.0 lux in the GUI, yet it does not seem to use illuminance
            directLightColor: [0.9, 0.9, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0, //8000.0, Turned off -- until we support world space light positioning.
            //lightDirection: [-0.2, -0.18, 0.72], //world space, not view space!
            bgColorGradient: bg["Plaza"],
            darkerFade: false,
            rotation: 0.0
        },

        {
            name: "Snow Field",            //  "Snow Field", localized in viewer-environments.loc.json
            path: "SnowField",
            type: "logluv",
            tonemap: 1,
            //illuminance: 4302.7773,
            E_bias: -10.461343,  // EV 14.526, 50000.0 lux (target)
            directLightColor: [1, 1, 1],
            ambientColor: [0.25 / 8, 0.25 / 8, 0.25 / 8],
            lightMultiplier: 0.0, //800.0, Turned off -- until we support world space light positioning.
            //lightDirection: [0.0, -1.0, 0.0], //world space, not view space!
            bgColorGradient: bg["Snow"],
            darkerFade: false,
            rotation: 0.0
        }
    ];

    if (Privite_Global.ENABLE_DEBUG) {
        LightPresets = LightPresets.concat(DebugEnvironments);
    }

    return LightPresets;
});