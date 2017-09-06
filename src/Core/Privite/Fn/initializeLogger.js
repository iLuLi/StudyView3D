define([
    '../../Logger',
    '../../Global',
    './loadDependency'
], function(
    Logger,
    Global,
    loadDependency
) {;
    'use strict'
    var initializeLogger = function (options) {

        var loggerConfig = {
            eventCallback: options ? options.eventCallback : undefined
        };

        Logger.initialize(loggerConfig);

        // ADP is opt-out
        if (options && options.hasOwnProperty('useADP') && options.useADP == false) {
            return;
        }
        //Also bail on ADP if we are a node module
        if (Global.isNodeJS)
            return;

        // Load Autodesk Data Platform client
        // (and if we're in RequireJS environment, use its APIs to avoid problems)
        var url = 'https://ase-cdn.autodesk.com/adp/v1.0.2/js/adp-web-analytics-sdk.min.js';
        var callback = function () {
            if (typeof (Adp) === 'undefined') {
                Logger.warn('Autodesk Data Platform SDK not found');
                return;
            }

            var adpConfig;
            switch (LMV_BUILD_TYPE) {
                case 'Production': adpConfig = AdpConfigs['prod']; break;
                default: adpConfig = AdpConfigs['stg']; break;
            }
            var facets = {
                product: {
                    name: 'LMV',
                    line_name: 'LMV',
                    key: adpConfig.CLIENT_ID,
                    id: adpConfig.CLIENT_KEY,
                    id_provider: 'O2',
                    build_id: LMV_VIEWER_VERSION + '.' + LMV_VIEWER_PATCH,
                    build_tag: LMV_BUILD_TYPE
                }
            };
            var config = {
                server: adpConfig.ENDPOINT,
                enable_geo_data: false,
                enable_browser_data: true,
                enable_session_messages: true
            };
            Logger.adp = new Adp(facets, config);
        };

        if (typeof requirejs !== 'undefined') {
            requirejs([url], function (adp) {
                window['Adp'] = adp;
                callback();
            });
        } else {
            loadDependency('Adp', url, callback);
        }
    };

    return initializeLogger;
});