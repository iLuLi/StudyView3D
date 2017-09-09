define(['./DeviceType', './Global'], function(DeviceType, Global) {;
    'use strict'
    return {
        "ambientShadows": true,
        "antialiasing": !DeviceType.isMobile,
        "groundShadow": true,
        "groundReflection": false,
        "progressiveRendering": true,
        "swapBlackAndWhite": false,
        "environmentMap": false,
        "openPropertiesOnSelect": false,
        "ghosting": true,
        "viewCube": !DeviceType.isMobile,
        "lineRendering": true,
        "lightPreset": Global.DefaultLightPreset,
        "backgroundColorPreset": null,
        "reverseMouseZoomDir": false,
        "reverseHorizontalLookDirection": false,
        "reverseVerticalLookDirection": false,
        "alwaysUsePivot": false,
        "zoomTowardsPivot": false,
        "orbitPastWorldPoles": true,
        "leftHandedMouseSetup": false,
        "clickToSetCOI": false,
        "optimizeNavigation": DeviceType.isMobile,
        "fusionOrbit": true,
        "fusionOrbitConstrained": true,
        "useFirstPersonNavigation": true, // Replaces the "Walk" tool with the "First Person" tool
        "envMapBackground": false,
        "renderPrism": true,
        "firstPersonToolPopup": true
    }
});