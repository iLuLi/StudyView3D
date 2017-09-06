define([
    '../../Global',
    '../Global',
    './initializeEnvironmentVariable',
    './initializeServiceEndPoints',
    './initializeLogger',
    './initializeAuth',
    './initializeProtein',
    '../../../Worker/initWorkerScript',
    './loadDependency',
    '../../Three/ddsLoader',
    '../../Three/pvrLoader',
    '../../Logger',
    './initializeLocalization',
    './initializeUserInfo'
], function(
    Global, 
    Privite_Global,
    initializeEnvironmentVariable,
    initializeServiceEndPoints,
    initializeLogger,
    initializeAuth,
    initializeProtein,
    initWorkerScript,
    loadDependency,
    ddsLoader,
    pvrLoader,
    Logger,
    initializeLocalization,
    initializeUserInfo
) {
    'use strict';
    /**
     * This is the Initializer class that initializes the viewer runtime, including:
     *
     *  - End points of cloud services the viewer uses, like viewing service and search service.
     *  - Authentication and authorization cookie settings on the client side.
     *  - Misc runtime environment variables and viewer configurations parameters.
     *
     *  @constructor
     *  @param {object} options - The options object contains configuration parameters used to do initializations. If no
     *                            access token or authentication callback is provided, the Initializer will fall back
     *                            on an access token provided in the URL query string, or a previous access token stored in
     *                            the cookie cache, if available.
     *  @param {string} [options.env] - Can be "Development", "Staging" or "Production", for viewers running without PAAS
     *                                  endpoints. Can be "AutodeskDevelopment", "AutodeskStaging", or "AutodeskProduction"
     *                                  for viewers running with PAAS endpoints.
     *  @param {function} [options.getAccessToken] - An function that provides an access token asynchronously. The function signature
     *                                               is getAccessToken(onSuccess), where onSuccess is a callback that getAccessToken function
     *                                               should invoke when a token is granted, with the token being the first input parameter for the
     *                                               onSuccess function, and the token expire time (in seconds) being the second input parameter for the
     *                                               function. Viewer relies on both getAccessToken and the expire time to automatically renew token, so
     *                                               it is critical that getAccessToken must be implemented as described here.
     *  @param {boolean} [options.useADP] - whether to report analytics to ADP. True by default.
     *
     *  @param {string} [options.accessToken] - An access token
     *  @param {string} [options.webGLHelpLink] - A link to a help page on webGL if it's disabled.
     *  @param {string} [options.language] - Preferred language code as defined in RFC 4646, such as "en", "de", "fr", etc.
     *  If no language is set, viewer will pick it up from the browser. If language is not as defined in RFC,
     *  viewer will fall back to "en" but the behavior is undefined.
     *
     *  @param {function} callback - A method the client executes when initialization is finished.
     *
     *  @example
     *   var options = {
     *      env: "Production",
     *      language: "en",
     *      webGLHelpLink: "http://my.webgl.help.link",
     *      getAccessToken: function(onSuccess) {
     *          var accessToken, expire;
     *          // Code to retrieve and assign token value to
     *          // accessToken and expire time in seconds.
     *          onSuccess(accessToken, expire);
     *      }
     *   };
     *   var callback = function() {
     *      alert("initialization complete");
     *   };
     *   Autodesk.Viewing.Initializer(options, callback);
     */
    return function (options, callback) {
        
        if (Global.isNodeJS) {

            initializeEnvironmentVariable(options);
            initializeServiceEndPoints(options);
            initializeLogger(options);
            //avp.initializeProtein(); //TODO:NODE

            //init_three_dds_loader(); //TODO:NODE
            //init_three_pvr_loader(); //TODO:NODE
            initializeAuth(callback, options);

        } else {

            Privite_Global.WEBGL_HELP_LINK = options ? options.webGLHelpLink : null;
            initializeEnvironmentVariable(options);
            initializeServiceEndPoints(options);
            initializeLogger(options);
            initializeProtein();

            function init() {

                //Temporarily silence THREE.warn due to new builds of Chrome producing oodles of shader compile warnings.
                THREE.warn = Logger.warn.bind(Logger);

                ddsLoader();
                pvrLoader();
                initializeAuth(callback, options);
                initializeLocalization(options);
                initializeUserInfo(options);
            }

            //Kick off a request for the web worker script, so it loads in parallel with three.js
            initWorkerScript();

            //Load three.js then continue initialization
            loadDependency("THREE", "three.min.js", init);
        }
    };
});