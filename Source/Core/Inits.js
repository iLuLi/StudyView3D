define([
    './Logger',
    './Constants/Global',
    './Utils/initWorkerScript',
    './Utils/loadDependency',
    './Utils/getParameterByName',
    './Utils/getParameterByNameFromPath',
    './Utils/setLanguage',
    './Utils/setUserName',
    './Utils/getScript'
], function (
    Logger, 
    Global, 
    initWorkerScript, 
    loadDependency, 
    getParameterByName, 
    getParameterByNameFromPath, 
    setLanguage, 
    setUserName, 
    getScript
) {
    'use strict';

    var LmvEndpoints = {
        local: {
            RTC: ['https://rtc-dev.api.autodesk.com:443', 'https://lmv.autodesk.com:443'] //port # is required here.
        },
        dev: {
            RTC: ['https://rtc-dev.api.autodesk.com:443', 'https://lmv.autodesk.com:443']
        },
        stg: {
            RTC: ['https://rtc-stg.api.autodesk.com:443', 'https://lmv.autodesk.com:443']
        },
        prod: {
            RTC: ['https://rtc.api.autodesk.com:443', 'https://lmv.autodesk.com:443']
        }
    };

    var ViewingApiUrls = {
        local: "",
        dev: "https://viewing-dev.api.autodesk.com",
        stg: "https://viewing-staging.api.autodesk.com",
        prod: "https://viewing.api.autodesk.com"
    };

    var DevApiUrls = {
        local: "",
        dev: "https://developer-dev.api.autodesk.com",
        stg: "https://developer-stg.api.autodesk.com",
        prod: "https://developer.api.autodesk.com"
    };

    // The apps on https://developer.autodesk.com had to be created under an ADS account... Ask for brozp
    var AdpConfigs = {
        stg: { CLIENT_ID: 'lmv-stag', CLIENT_KEY: 'kjemi1rwAgsqIqyvDUtc9etPD6MsAzbV', ENDPOINT: 'https://ase-stg.autodesk.com' },
        prod: { CLIENT_ID: 'lmv-prod', CLIENT_KEY: 'iaoUM2CRGydfn703yfPq4MAogZi8I5u4', ENDPOINT: 'https://ase.autodesk.com' }
    }

    var APIS = {
        ACM: '/oss-ext/v1/acmsessions',
        OSS: '/oss/v1',
        VIEWING: '/viewingservice/v1',
        VIEWING2: '/derivativeservice/v2'
    };

    var EnvironmentConfigurations = {
        Local: {
            ROOT: '',
            VIEWING: '',
            ACM: '',
            OSS: '',
            LMV: LmvEndpoints["local"]
        },
        Development: {
            ROOT: ViewingApiUrls["dev"],
            VIEWING: ViewingApiUrls["dev"] + APIS.VIEWING,
            ACM: DevApiUrls["dev"] + APIS.ACM,
            OSS: DevApiUrls["dev"] + APIS.OSS,
            LMV: LmvEndpoints["dev"]
        },
        Staging: {
            ROOT: ViewingApiUrls["stg"],
            VIEWING: ViewingApiUrls["stg"] + APIS.VIEWING,
            ACM: DevApiUrls["stg"] + APIS.ACM,
            OSS: DevApiUrls["stg"] + APIS.OSS,
            LMV: LmvEndpoints["stg"]
        },
        Production: {
            ROOT: ViewingApiUrls["prod"],
            VIEWING: ViewingApiUrls["prod"] + APIS.VIEWING,
            ACM: DevApiUrls["prod"] + APIS.ACM,
            OSS: DevApiUrls["prod"] + APIS.OSS,
            LMV: LmvEndpoints["prod"]
        },
        AutodeskDevelopment: {
            ROOT: DevApiUrls["dev"],
            VIEWING: DevApiUrls["dev"] + APIS.VIEWING,
            ACM: DevApiUrls["dev"] + APIS.ACM,
            OSS: DevApiUrls["dev"] + APIS.OSS,
            LMV: LmvEndpoints["dev"]
        },
        AutodeskStaging: {
            ROOT: DevApiUrls["stg"],
            VIEWING: DevApiUrls["stg"] + APIS.VIEWING,
            ACM: DevApiUrls["stg"] + APIS.ACM,
            OSS: DevApiUrls["stg"] + APIS.OSS,
            LMV: LmvEndpoints["stg"]
        },
        AutodeskProduction: {
            ROOT: DevApiUrls["prod"],
            VIEWING: DevApiUrls["prod"] + APIS.VIEWING,
            ACM: DevApiUrls["prod"] + APIS.ACM,
            OSS: DevApiUrls["prod"] + APIS.OSS,
            LMV: LmvEndpoints["prod"]
        },
        DevelopmentV2: {
            ROOT: ViewingApiUrls["dev"],
            VIEWING: ViewingApiUrls["dev"] + APIS.VIEWING2,
            ACM: DevApiUrls["dev"] + APIS.ACM,
            OSS: DevApiUrls["dev"] + APIS.OSS,
            LMV: LmvEndpoints["dev"]
        },
        StagingV2: {
            ROOT: ViewingApiUrls["stg"],
            VIEWING: ViewingApiUrls["stg"] + APIS.VIEWING2,
            ACM: DevApiUrls["stg"] + APIS.ACM,
            OSS: DevApiUrls["stg"] + APIS.OSS,
            LMV: LmvEndpoints["stg"]
        },
        ProductionV2: {
            ROOT: ViewingApiUrls["prod"],
            VIEWING: ViewingApiUrls["prod"] + APIS.VIEWING2,
            ACM: DevApiUrls["prod"] + APIS.ACM,
            OSS: DevApiUrls["prod"] + APIS.OSS,
            LMV: LmvEndpoints["prod"]
        },
        AutodeskDevelopmentV2: {
            ROOT: DevApiUrls["dev"],
            VIEWING: DevApiUrls["dev"] + APIS.VIEWING2,
            ACM: DevApiUrls["dev"] + APIS.ACM,
            OSS: DevApiUrls["dev"] + APIS.OSS,
            LMV: LmvEndpoints["dev"]
        },
        AutodeskStagingV2: {
            ROOT: DevApiUrls["stg"],
            VIEWING: DevApiUrls["stg"] + APIS.VIEWING2,
            ACM: DevApiUrls["stg"] + APIS.ACM,
            OSS: DevApiUrls["stg"] + APIS.OSS,
            LMV: LmvEndpoints["stg"]
        },
        AutodeskProductionV2: {
            ROOT: DevApiUrls["prod"],
            VIEWING: DevApiUrls["prod"] + APIS.VIEWING2,
            ACM: DevApiUrls["prod"] + APIS.ACM,
            OSS: DevApiUrls["prod"] + APIS.OSS,
            LMV: LmvEndpoints["prod"]
        }
    };
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
    var Initializer = function (options, callback) {

        if (Global.isNodeJS) {

            initializeEnvironmentVariable(options);
            initializeServiceEndPoints(options);
            initializeLogger(options);
            //avp.initializeProtein(); //TODO:NODE

            //init_three_dds_loader(); //TODO:NODE
            //init_three_pvr_loader(); //TODO:NODE
            initializeAuth(callback, options);

        } else {

            Global.WEBGL_HELP_LINK = options ? options.webGLHelpLink : null;
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

    /**
     * 初始化全局env，offline
     * @param {*} options 
     */
    var initializeEnvironmentVariable = function (options) {
        var env;

        // Use the enviroment that was explicitly specified.
        //
        if (options && options.env) {
            env = options.env;
        }

        // If not available, check if the environment was specified in the query parameters.
        //
        if (!env) {
            env = getParameterByName("env");
        }

        if (options && options.offlineResourcePrefix) {
            Global.offlineResourcePrefix = options.offlineResourcePrefix;
        }

        if (options && options.offline && options.offline === "true") {
            Global.offline = true;
        }

        // If still not available, try to resolve the environment based on the url.
        //
        if (!env) {
            // FIXME: with the introduction of v2 end points, this would not work. We either
            // have to enforce user must pass an env variable to viewer, or parse URL here.
            switch (window.location.hostname) {
                case "viewing-dev.api.autodesk.com":
                    env = 'Development';
                    break;
                case "viewing-staging.api.autodesk.com":
                    env = 'Staging';
                    break;
                case "viewing.api.autodesk.com":
                    env = 'Production';
                    break;
                case "developer-dev.api.autodesk.com":
                    env = 'AutodeskDevelopment';
                    break;
                case "developer-stg.api.autodesk.com":
                    env = 'AutodeskStaging';
                    break;
                case "developer.api.autodesk.com":
                    env = 'AutodeskProduction';
                    break;

                case "localhost.autodesk.com":
                    env = 'Local';
                    break;
                case "": // IP addresses on Chrome.
                    env = 'Local';
                    break;
                case "127.0.0.1":
                    env = 'Local';
                    break;
                default:
                    env = 'AutodeskProduction';
            }
        }

        if (Global.ENABLE_TRACE) {
            if (typeof window !== "undefined")
                console.log("Host name : " + window.location.hostname);
            console.log("Environment initialized as : " + env);
        }
        Global.env = env;
    };

    var initializeUserInfo = function (options) {
        if (!options || !options.userInfo) return;
        setUserName(options.userInfo.name);
        if (options.comment2Token) {
            Global.comment2Token = options.comment2Token;
        }
    };

    /**
     * 分析js文件所在目录
     * @param {*} options 
     */
    var initializeServiceEndPoints = function (options) {
        var env = Global.env;
        var config = EnvironmentConfigurations[env];
        Global.VIEWING_URL = config['VIEWING'];
        Global.ACM_SESSION_URL = config['ACM'];
        Global.OSS_URL = config['OSS'];

        if (Global.isNodeJS)
            return;

        //Derive the root for static viewer resources based on the
        //location of the main viewer script
        var libList = [
            "viewer3D.js",
            "viewer3D.min.js",
            "firefly.js",
            "firefly.min.js"
        ];
        if (options && options.hasOwnProperty('libraryName'))
            libList.push(options.libraryName);

        var root;
        var scriptUrl;

        // TODO_NOP: this doesn't work for Polymer / Web Components
        for (var i = 0; i < libList.length; i++) {
            var script = getScript(libList[i]);
            scriptUrl = script ? script.src : "";
            var idx = scriptUrl.indexOf(libList[i]);
            if (idx >= 0) {
                root = scriptUrl.substr(0, idx);
                break;
            }
        }

        //Derive any custom version request
        Global.LMV_RESOURCE_VERSION = "v" + Global.LMV_VIEWER_VERSION;

        var version = getParameterByNameFromPath("v", scriptUrl);
        if (version && version.length && version != Global.LMV_RESOURCE_VERSION) {
            console.warn("Version string mismatch between requested and actual version: " + version + " vs. " + Global.LMV_RESOURCE_VERSION + ". Using " + version);
            Global.LMV_RESOURCE_VERSION = version;
        } else if (!version || !version.length) {
            Global.LMV_RESOURCE_VERSION = null;
            console.info("No viewer version specified, will implicitly use " + Global.LMV_VIEWER_VERSION);
        }

        Global.LMV_RESOURCE_ROOT = root || Global.LMV_RESOURCE_ROOT;
    };

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
            switch (Global.LMV_BUILD_TYPE) {
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
                    build_id: Global.LMV_VIEWER_VERSION + '.' + Global.LMV_VIEWER_PATCH,
                    build_tag: Global.LMV_BUILD_TYPE
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

    var initializeAuth = function (onSuccessCallback, options) {

        var shouldInitializeAuth = options ? options.shouldInitializeAuth : undefined;
        if (shouldInitializeAuth === undefined) {
            var p = getParameterByName("auth");
            shouldInitializeAuth = (p.toLowerCase() !== "false");
        }

        //Skip Auth in case we are serving the viewer locally
        if (Global.env == "Local" || !shouldInitializeAuth) {
            setTimeout(onSuccessCallback, 0);
            Global.auth = false;
            return Global.auth;
        }

        //For Node.js, we will use the Authorization header instead of cookie
        if (Global.isNodeJS)
            LMV_THIRD_PARTY_COOKIE = false;

        // Keep this to make existing client code happy.
        Global.auth = true;

        var accessToken;
        if (options && options.getAccessToken) {
            function onGetAccessToken(token /* access token value. */, expire /* expire time, in seconds. */) {
                accessToken = token;
                refreshToken(accessToken, Global.token.tokenRefreshInterval ? null /* If this is a token refresh call,
                    don't invoke the onSuccessCallback which will loadDocument and so on. */
                    : onSuccessCallback);
                var interval = expire - 60; // Refresh 1 minute before token expire.
                if (interval <= 0) {
                    // We can't get a precise upper bound if the token is such a short lived one (expire in a minute),
                    // so just use the original one.
                    interval = expire;
                }
                Global.token.tokenRefreshInterval = interval * 1000;
                setTimeout(function () { options.getAccessToken(onGetAccessToken) }, Global.token.tokenRefreshInterval);
            }
            Global.token.getAccessToken = options.getAccessToken;

            accessToken = options.getAccessToken(onGetAccessToken);

            //Backwards compatibility with the old synchronous API
            if (typeof accessToken == "string" && accessToken) {
                refreshToken(accessToken, onSuccessCallback);
            }

        } else if (options && options.accessToken) {
            accessToken = options.accessToken;
            refreshToken(accessToken, onSuccessCallback);
        } else {
            accessToken = getParameterByName("accessToken");
            if (!accessToken) {
                accessToken = "9AMaRKBoPCIBy61JmQ8OLLLyRblS";
                Logger.warn("Warning : no access token is provided. Use built in token : " + accessToken);
            }
            refreshToken(accessToken, onSuccessCallback);
        }

        return Global.auth;
    };

    var initializeLocalization = function (options) {
        // Initialize language for localization. The corresponding string files
        // will be downloaded.
        var language = (options && options.language) || navigator.language;

        // use iso scheme (ab/ab-XY)
        var tags = language.split('-');
        language = tags.length > 1 ? tags[0].toLowerCase() + '-' + tags[1].toUpperCase() : tags[0].toLowerCase();

        // check supported language tags and subtags
        var supportedTags = ["cs", "de", "en", "es", "fr", "it", "ja", "ko", "pl", "pt-BR", "ru", "tr", "zh-HANS", "zh-HANT"];
        if (supportedTags.indexOf(language) === -1) {
            if (language.indexOf("zh-CN") > -1) language = "zh-HANS";
            else if (language.indexOf("zh-TW") > -1) language = "zh-HANT";
            else if (tags.length > 1 && supportedTags.indexOf(tags[0]) > -1) language = tags[0];
            else language = "en";
        }

        // Uncomment below to default to english
        //language = "en";
        setLanguage(language);
    };

    var initializeProtein = function () {

        //For local work, don't redirect texture requests to the CDN,
        //because local ones will load much faster, presumably.
        if (Global.ENABLE_DEBUG && Global.env == "Local" && !Global.auth /* when auth is true, the viewer is operating under
        local mode but connect to remote server to get data. */)
            return;

        // In offline mode, viewer will get the texture from the locally cached SVF data sets, instead pinging texture
        // CDN.
        // TODO: this will break when translators stop including Protein into SVF.
        if (Global.offline) {
            return;
        }

        var xhr1 = new XMLHttpRequest();
        xhr1.open("GET", "https://raas-assets.autodesk.com/StaticContent/BaseAddress?family=protein", true);
        xhr1.responseType = "json";

        xhr1.onload = function (e) {
            var res = xhr1.response.url;
            if (res && res.length) {
                res = res.replace("http://", "https://");
                PROTEIN_ROOT = res + "/";
                Logger.info("Protein root is: " + PROTEIN_ROOT);
            }
        };

        xhr1.send();

        var xhr2 = new XMLHttpRequest();
        xhr2.open("GET", "https://raas-assets.autodesk.com/StaticContent/BaseAddress?family=prism", true);
        xhr2.responseType = "json";

        xhr2.onload = function (e) {
            var res = xhr2.response.url;
            if (res && res.length) {
                res = res.replace("http://", "https://");
                PRISM_ROOT = res + "/";
                Logger.info("Prism root is: " + PRISM_ROOT);
            }
        };

        //xhr.onerror = ;
        //xhr.ontimeout = ;

        xhr2.send();
    };

    var initLoadContext = function (inputObj) {

        inputObj = inputObj || {};

        inputObj.auth = Global.auth;
        inputObj.viewing_url = Global.VIEWING_URL;
        inputObj.oss_url = Global.OSS_URL;

        if (!inputObj.headers)
            inputObj.headers = {};

        for (var p in Global.HTTP_REQUEST_HEADERS) {
            inputObj.headers[p] = Global.HTTP_REQUEST_HEADERS[p];
        }

        return inputObj;
    };
    var refreshCookie = function (token, onSuccess, onError) {

        var xhr = new XMLHttpRequest();
        xhr.onload = onSuccess;
        xhr.onerror = onError;
        xhr.ontimeout = onError;

        // We support two set token end points, the native VS end point and the wrapped apigee end point.
        if (Global.env.indexOf('Autodesk') === 0) {
            // This really sucks, as Apigee end points use different naming pattern than viewing service.
            var url = EnvironmentConfigurations[Global.env].ROOT;

            xhr.open("POST", url + "/utility/v1/settoken", true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.withCredentials = true;

            xhr.send("access-token=" + token);

            // Here we control whether to go through IE 11's authentication code path or not.
            if (av.isIE11) {
                avp.accessToken = token;
            }
        }
        else {
            var token =
                {
                    "oauth": {
                        "token": token
                    }
                };

            // console.log("auth token : " + JSON.stringify(token));

            xhr.open("POST", VIEWING_URL + "/token", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.withCredentials = true;

            xhr.send(JSON.stringify(token));
        }

    };

    // Refresh the token in request header, in case that the third party cookie is disabled
    var refreshRequestHeader = function (token) {

        Global.HTTP_REQUEST_HEADERS["Authorization"] = "Bearer " + token;

    };

    var refreshToken = function (token, onSuccess, onError) {

        // Store the token, it will be used when third-party cookies are disabled
        Global.token.accessToken = token;

        // At the beginning, try to store the token in cookie
        if (Global.LMV_THIRD_PARTY_COOKIE === undefined) {
            refreshCookie(token, onSuccess, onError);
        } else {
            doTokenRefresh();
        }

        // if third-party cookies are enabled in browser, then put token in cookie
        // if not, put token into request header
        function doTokenRefresh() {

            if (Global.LMV_THIRD_PARTY_COOKIE) {

                refreshCookie(token, onSuccess, onError);

            } else {

                refreshRequestHeader(token);
                onSuccess();

            }
        }

    };
    var getAuthObject = function () {
        return Global.auth;
    };

    /*
    * @author mrdoob / http://mrdoob.com/
    */

    var ddsLoader = function () {

        THREE.DDSLoader = function () {
            this._parser = THREE.DDSLoader.parse;
        };

        THREE.DDSLoader.prototype = Object.create(THREE.CompressedTextureLoader.prototype);
        THREE.DDSLoader.prototype.constructor = THREE.DDSLoader;

        THREE.DDSLoader.parse = function (buffer, loadMipmaps) {

            var dds = { mipmaps: [], width: 0, height: 0, format: null, mipmapCount: 1 };

            // Adapted from @toji's DDS utils
            //	https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js

            // All values and structures referenced from:
            // http://msdn.microsoft.com/en-us/library/bb943991.aspx/

            var DDS_MAGIC = 0x20534444;

            var DDSD_CAPS = 0x1,
                DDSD_HEIGHT = 0x2,
                DDSD_WIDTH = 0x4,
                DDSD_PITCH = 0x8,
                DDSD_PIXELFORMAT = 0x1000,
                DDSD_MIPMAPCOUNT = 0x20000,
                DDSD_LINEARSIZE = 0x80000,
                DDSD_DEPTH = 0x800000;

            var DDSCAPS_COMPLEX = 0x8,
                DDSCAPS_MIPMAP = 0x400000,
                DDSCAPS_TEXTURE = 0x1000;

            var DDSCAPS2_CUBEMAP = 0x200,
                DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
                DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
                DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
                DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
                DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
                DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
                DDSCAPS2_VOLUME = 0x200000;

            var DDPF_ALPHAPIXELS = 0x1,
                DDPF_ALPHA = 0x2,
                DDPF_FOURCC = 0x4,
                DDPF_RGB = 0x40,
                DDPF_YUV = 0x200,
                DDPF_LUMINANCE = 0x20000;

            function fourCCToInt32(value) {

                return value.charCodeAt(0) +
                    (value.charCodeAt(1) << 8) +
                    (value.charCodeAt(2) << 16) +
                    (value.charCodeAt(3) << 24);

            }

            function int32ToFourCC(value) {

                return String.fromCharCode(
                    value & 0xff,
                    (value >> 8) & 0xff,
                    (value >> 16) & 0xff,
                    (value >> 24) & 0xff
                );
            }

            function loadARGBMip(buffer, dataOffset, width, height) {
                var dataLength = width * height * 4;
                var srcBuffer = new Uint8Array(buffer, dataOffset, dataLength);
                var byteArray = new Uint8Array(dataLength);
                var dst = 0;
                var src = 0;
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        var b = srcBuffer[src]; src++;
                        var g = srcBuffer[src]; src++;
                        var r = srcBuffer[src]; src++;
                        var a = srcBuffer[src]; src++;
                        byteArray[dst] = r; dst++;	//r
                        byteArray[dst] = g; dst++;	//g
                        byteArray[dst] = b; dst++;	//b
                        byteArray[dst] = a; dst++;	//a
                    }
                }
                return byteArray;
            }

            var FOURCC_DXT1 = fourCCToInt32("DXT1");
            var FOURCC_DXT3 = fourCCToInt32("DXT3");
            var FOURCC_DXT5 = fourCCToInt32("DXT5");

            var headerLengthInt = 31; // The header length in 32 bit ints

            // Offsets into the header array

            var off_magic = 0;

            var off_size = 1;
            var off_flags = 2;
            var off_height = 3;
            var off_width = 4;

            var off_mipmapCount = 7;

            var off_pfFlags = 20;
            var off_pfFourCC = 21;
            var off_RGBBitCount = 22;
            var off_RBitMask = 23;
            var off_GBitMask = 24;
            var off_BBitMask = 25;
            var off_ABitMask = 26;

            var off_caps = 27;
            var off_caps2 = 28;
            var off_caps3 = 29;
            var off_caps4 = 30;

            // Parse header

            var header = new Int32Array(buffer, 0, headerLengthInt);

            if (header[off_magic] !== DDS_MAGIC) {

                console.error('THREE.DDSLoader.parse: Invalid magic number in DDS header.');
                return dds;

            }

            if (!header[off_pfFlags] & DDPF_FOURCC) {

                console.error('THREE.DDSLoader.parse: Unsupported format, must contain a FourCC code.');
                return dds;

            }

            var blockBytes;

            var fourCC = header[off_pfFourCC];

            var isRGBAUncompressed = false;

            switch (fourCC) {

                case FOURCC_DXT1:

                    blockBytes = 8;
                    dds.format = THREE.RGB_S3TC_DXT1_Format;
                    break;

                case FOURCC_DXT3:

                    blockBytes = 16;
                    dds.format = THREE.RGBA_S3TC_DXT3_Format;
                    break;

                case FOURCC_DXT5:

                    blockBytes = 16;
                    dds.format = THREE.RGBA_S3TC_DXT5_Format;
                    break;

                default:

                    if (header[off_RGBBitCount] == 32
                        && header[off_RBitMask] & 0xff0000
                        && header[off_GBitMask] & 0xff00
                        && header[off_BBitMask] & 0xff
                        && header[off_ABitMask] & 0xff000000) {
                        isRGBAUncompressed = true;
                        blockBytes = 64;
                        dds.format = THREE.RGBAFormat;
                    } else {
                        console.error('THREE.DDSLoader.parse: Unsupported FourCC code ', int32ToFourCC(fourCC));
                        return dds;
                    }
            }

            dds.mipmapCount = 1;

            if (header[off_mipmapCount] > 0 && loadMipmaps !== false) {

                dds.mipmapCount = Math.max(1, header[off_mipmapCount]);

            }

            //TODO: Verify that all faces of the cubemap are present with DDSCAPS2_CUBEMAP_POSITIVEX, etc.

            dds.isCubemap = header[off_caps2] & DDSCAPS2_CUBEMAP ? true : false;

            dds.width = header[off_width];
            dds.height = header[off_height];

            var dataOffset = header[off_size] + 4;

            // Extract mipmaps buffers

            var width = dds.width;
            var height = dds.height;

            var faces = dds.isCubemap ? 6 : 1;

            for (var face = 0; face < faces; face++) {

                for (var i = 0; i < dds.mipmapCount; i++) {

                    if (isRGBAUncompressed) {
                        var byteArray = loadARGBMip(buffer, dataOffset, width, height);
                        var dataLength = byteArray.length;
                    } else {
                        var dataLength = Math.max(4, width) / 4 * Math.max(4, height) / 4 * blockBytes;
                        var byteArray = new Uint8Array(buffer, dataOffset, dataLength);
                    }

                    var mipmap = { "data": byteArray, "width": width, "height": height };
                    dds.mipmaps.push(mipmap);

                    dataOffset += dataLength;

                    width = Math.max(width * 0.5, 1);
                    height = Math.max(height * 0.5, 1);

                }

                width = dds.width;
                height = dds.height;

            }

            return dds;

        };

    };

    /*
    *	 PVRLoader
    *   Author: pierre lepers
    *   Date: 17/09/2014 11:09
    *
    *	 PVR v2 (legacy) parser
    *   TODO : Add Support for PVR v3 format
    *   TODO : implement loadMipmaps option
    */
    var pvrLoader = function () {

        THREE.PVRLoader = function (manager) {

            this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;

            this._parser = THREE.PVRLoader.parse;

        };

        THREE.PVRLoader.prototype = Object.create(THREE.CompressedTextureLoader.prototype);
        THREE.PVRLoader.prototype.constructor = THREE.PVRLoader;


        THREE.PVRLoader.parse = function (buffer, loadMipmaps) {

            var headerLengthInt = 13;
            var header = new Uint32Array(buffer, 0, headerLengthInt);

            var pvrDatas = {
                buffer: buffer,
                header: header,
                loadMipmaps: loadMipmaps
            };

            // PVR v3
            if (header[0] === 0x03525650) {

                return THREE.PVRLoader._parseV3(pvrDatas);

            }
            // PVR v2
            else if (header[11] === 0x21525650) {

                return THREE.PVRLoader._parseV2(pvrDatas);

            } else {

                throw new Error("[THREE.PVRLoader] Unknown PVR format");

            }

        };

        THREE.PVRLoader._parseV3 = function (pvrDatas) {

            var header = pvrDatas.header;
            var bpp, format;


            var metaLen = header[12],
                pixelFormat = header[2],
                height = header[6],
                width = header[7],
                numSurfs = header[9],
                numFaces = header[10],
                numMipmaps = header[11];

            switch (pixelFormat) {
                case 0: // PVRTC 2bpp RGB
                    bpp = 2;
                    format = THREE.RGB_PVRTC_2BPPV1_Format;
                    break;
                case 1: // PVRTC 2bpp RGBA
                    bpp = 2;
                    format = THREE.RGBA_PVRTC_2BPPV1_Format;
                    break;
                case 2: // PVRTC 4bpp RGB
                    bpp = 4;
                    format = THREE.RGB_PVRTC_4BPPV1_Format;
                    break;
                case 3: // PVRTC 4bpp RGBA
                    bpp = 4;
                    format = THREE.RGBA_PVRTC_4BPPV1_Format;
                    break;
                default:
                    throw new Error("pvrtc - unsupported PVR format " + pixelFormat);
            }

            pvrDatas.dataPtr = 52 + metaLen;
            pvrDatas.bpp = bpp;
            pvrDatas.format = format;
            pvrDatas.width = width;
            pvrDatas.height = height;
            pvrDatas.numSurfaces = numFaces;
            pvrDatas.numMipmaps = numMipmaps;

            pvrDatas.isCubemap = (numFaces === 6);

            return THREE.PVRLoader._extract(pvrDatas);

        };

        THREE.PVRLoader._parseV2 = function (pvrDatas) {

            var header = pvrDatas.header;

            var headerLength = header[0],
                height = header[1],
                width = header[2],
                numMipmaps = header[3],
                flags = header[4],
                dataLength = header[5],
                bpp = header[6],
                bitmaskRed = header[7],
                bitmaskGreen = header[8],
                bitmaskBlue = header[9],
                bitmaskAlpha = header[10],
                pvrTag = header[11],
                numSurfs = header[12];


            var TYPE_MASK = 0xff;
            var PVRTC_2 = 24,
                PVRTC_4 = 25;

            var formatFlags = flags & TYPE_MASK;



            var bpp, format;
            var _hasAlpha = bitmaskAlpha > 0;

            if (formatFlags === PVRTC_4) {

                format = _hasAlpha ? THREE.RGBA_PVRTC_4BPPV1_Format : THREE.RGB_PVRTC_4BPPV1_Format;
                bpp = 4;

            } else if (formatFlags === PVRTC_2) {

                format = _hasAlpha ? THREE.RGBA_PVRTC_2BPPV1_Format : THREE.RGB_PVRTC_2BPPV1_Format;
                bpp = 2;

            } else
                throw new Error("pvrtc - unknown format " + formatFlags);



            pvrDatas.dataPtr = headerLength;
            pvrDatas.bpp = bpp;
            pvrDatas.format = format;
            pvrDatas.width = width;
            pvrDatas.height = height;
            pvrDatas.numSurfaces = numSurfs;
            pvrDatas.numMipmaps = numMipmaps + 1;

            // guess cubemap type seems tricky in v2
            // it juste a pvr containing 6 surface (no explicit cubemap type)
            pvrDatas.isCubemap = (numSurfs === 6);

            return THREE.PVRLoader._extract(pvrDatas);

        };


        THREE.PVRLoader._extract = function (pvrDatas) {

            var pvr = {
                mipmaps: [],
                width: pvrDatas.width,
                height: pvrDatas.height,
                format: pvrDatas.format,
                mipmapCount: pvrDatas.numMipmaps,
                isCubemap: pvrDatas.isCubemap
            };

            var buffer = pvrDatas.buffer;



            // console.log( "--------------------------" );

            // console.log( "headerLength ", headerLength);
            // console.log( "height       ", height      );
            // console.log( "width        ", width       );
            // console.log( "numMipmaps   ", numMipmaps  );
            // console.log( "flags        ", flags       );
            // console.log( "dataLength   ", dataLength  );
            // console.log( "bpp          ", bpp         );
            // console.log( "bitmaskRed   ", bitmaskRed  );
            // console.log( "bitmaskGreen ", bitmaskGreen);
            // console.log( "bitmaskBlue  ", bitmaskBlue );
            // console.log( "bitmaskAlpha ", bitmaskAlpha);
            // console.log( "pvrTag       ", pvrTag      );
            // console.log( "numSurfs     ", numSurfs    );




            var dataOffset = pvrDatas.dataPtr,
                bpp = pvrDatas.bpp,
                numSurfs = pvrDatas.numSurfaces,
                dataSize = 0,
                blockSize = 0,
                blockWidth = 0,
                blockHeight = 0,
                widthBlocks = 0,
                heightBlocks = 0;



            if (bpp === 2) {

                blockWidth = 8;
                blockHeight = 4;

            } else {

                blockWidth = 4;
                blockHeight = 4;

            }

            blockSize = (blockWidth * blockHeight) * bpp / 8;

            pvr.mipmaps.length = pvrDatas.numMipmaps * numSurfs;

            var mipLevel = 0;

            while (mipLevel < pvrDatas.numMipmaps) {

                var sWidth = pvrDatas.width >> mipLevel,
                    sHeight = pvrDatas.height >> mipLevel;

                widthBlocks = sWidth / blockWidth;
                heightBlocks = sHeight / blockHeight;

                // Clamp to minimum number of blocks
                if (widthBlocks < 2)
                    widthBlocks = 2;
                if (heightBlocks < 2)
                    heightBlocks = 2;

                dataSize = widthBlocks * heightBlocks * blockSize;


                for (var surfIndex = 0; surfIndex < numSurfs; surfIndex++) {

                    var byteArray = new Uint8Array(buffer, dataOffset, dataSize);

                    var mipmap = {
                        data: byteArray,
                        width: sWidth,
                        height: sHeight
                    };

                    pvr.mipmaps[surfIndex * pvrDatas.numMipmaps + mipLevel] = mipmap;

                    dataOffset += dataSize;


                }

                mipLevel++;

            }


            return pvr;

        };

    }


    return {
        Initializer: Initializer,
        initializeAuth: initializeAuth,
        initializeLocalization: initializeLocalization,
        initializeLogger: initializeLogger,
        initializeProtein: initializeProtein,
        initializeUserInfo: initializeUserInfo,
        initializeServiceEndPoints: initializeServiceEndPoints,
        initLoadContext: initLoadContext,
        initializeEnvironmentVariable: initializeEnvironmentVariable,

        EnvironmentConfigurations: EnvironmentConfigurations,
        refreshToken: refreshToken,
        refreshCookie: refreshCookie,
        refreshRequestHeader: refreshRequestHeader
        
    }


});