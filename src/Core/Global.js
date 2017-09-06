define(['./DeviceType', './Privite/Global'], function(DeviceType, Privite_Global) {
    'use strict'
    
    return {
        HTTP_REQUEST_HEADERS: {},

        TOOLBAR_CREATED_EVENT: 'toolbarCreated',
        SIDE_BAR_OPEN_EVENT: 'SIDE_BAR_OPEN_EVENT',
        TOOLBAR: {
            NAVTOOLSID: "navTools",
            MODELTOOLSID: "modelTools",
            SETTINGSTOOLSID: "settingsTools"
        },

        DefaultSettings: {
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
            "lightPreset": Privite_Global.DefaultLightPreset,
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
        },

        /**
         * Error code constants
         *
         * These constants will be used in onErrorCallbacks.
         *
         * @enum {number}
         * @readonly
         */
        ErrorCodes: {
            /** An unknown failure has occurred. */
            UNKNOWN_FAILURE: 1,

            /** Bad data (corrupted or malformed) was encountered. */
            BAD_DATA: 2,

            /** A network failure was encountered. */
            NETWORK_FAILURE: 3,

            /** Access was denied to a network resource (HTTP 403) */
            NETWORK_ACCESS_DENIED: 4,

            /** A network resource could not be found (HTTP 404) */
            NETWORK_FILE_NOT_FOUND: 5,

            /** A server error was returned when accessing a network resource (HTTP 5xx) */
            NETWORK_SERVER_ERROR: 6,

            /** An unhandled response code was returned when accessing a network resource (HTTP 'everything else') */
            NETWORK_UNHANDLED_RESPONSE_CODE: 7,

            /** Browser error: webGL is not supported by the current browser */
            BROWSER_WEBGL_NOT_SUPPORTED: 8,

            /** There is nothing viewable in the fetched document */
            BAD_DATA_NO_VIEWABLE_CONTENT: 9,

            /** Browser error: webGL is supported, but not enabled */
            BROWSER_WEBGL_DISABLED: 10,

            /** Collaboration server error */
            RTC_ERROR: 11

            }
        }
});