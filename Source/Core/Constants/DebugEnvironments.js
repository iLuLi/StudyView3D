define([
    './BackgroundPresets'
], function(bg) {
    'use strict';
    return [
        //More RaaS ones

       {
           name: "Field",            //  "Field", localized in viewer-environments.loc.json
           path: "field",
           type: "logluv",
           tonemap: 1,
           E_bias: -2.9,
           directLightColor: [1, 1, 1],
           lightMultiplier: 0.0,
           bgColorGradient: bg["Sky Blue"],
           darkerFade: false,
           rotation: 0.0
       },
       {
           name: "Crossroads",         //  "Crossroads", localized in viewer-environments.loc.json
           path: "crossroads",
           type: "logluv",
           tonemap: 1,
           E_bias: -5.5,
           directLightColor: [1, 1, 1],
           lightMultiplier: 0.0,
           bgColorGradient: bg["Sky Blue"],
           darkerFade: false,
           rotation: 0.0
       },

       {
           name: "Seaport",            //  "Seaport", localized in viewer-environments.loc.json
           path: "seaport",
           type: "logluv",
           tonemap: 1,
           E_bias: -6.5,
           directLightColor: [1, 1, 1],
           lightMultiplier: 0.0,
           bgColorGradient: bg["Sky Blue"],
           darkerFade: false,
           rotation: 0.0
       },

       {
           name: "Glacier",            //  "Glacier", localized in viewer-environments.loc.json
           path: "glacier",
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
           name: "Boardwalk",           //  "Boardwalk", localized in viewer-environments.loc.json
           path: "boardwalk",
           type: "logluv",
           tonemap: 1,
           E_bias: -7.0,
           directLightColor: [1, 1, 1],
           lightMultiplier: 0.0,
           bgColorGradient: bg["Sky Blue"],
           darkerFade: false,
           rotation: 0.0
       },

       {
           name: "RaaS Test Env",      // localized in viewer-environments.loc.json
           path: "Reflection",
           type: "logluv",
           tonemap: 2,
           E_bias: -1.5,
           directLightColor: [1, 1, 1],
           lightMultiplier: 0.0,
           bgColorGradient: bg["RaaS SBS"],
           darkerFade: false,
           rotation: 0.0
       }
];
});