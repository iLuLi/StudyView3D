define(['../DeviceType'], function(DeviceType) {;
    'use strict'

    var FRAGS_PERSISTENT_COUNT,
        FRAGS_PERSISTENT_MAX_COUNT,
        GEOMS_COUNT_LIMIT;
    var PAGEOUT_PERCENTAGE = 0.35;
    var isWeakDevice = DeviceType.isMobileDevice;
    if (!isWeakDevice) {
        // This is the fragments count that will persistent in memory all the time
        // even memory is low and some of geometry will be deleted.
        FRAGS_PERSISTENT_COUNT = 10000;
        // This is roughly the max number of fragments that can be handled in one go,
        // and in other words, exceeding this count will trigger on demand loading.
        // I guess on mobile device, this need to change to a smaller value.
        FRAGS_PERSISTENT_MAX_COUNT = 800000;
        // ??? Approximately use a max geometry count as a hint for
        // ??? when start to remove geometry to release memory.
        // ??? This needs experiments and dynamically change due to differnt browsers.
        GEOMS_COUNT_LIMIT = 300000;
    }
    else {
        // The following value are adjusted for weak device.
        // ??? This should be configurable for different type of devices.
        FRAGS_PERSISTENT_COUNT = 2000;
        FRAGS_PERSISTENT_MAX_COUNT = 150000;
        GEOMS_COUNT_LIMIT = 8000;
    }

    var memoryOptimizedLoading = true;
    var onDemandLoading = false && memoryOptimizedLoading;

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
    
    return {
        BUILD_LMV_WORKER_URL: "lmvworker.min.js",
        LMV_WORKER_URL: "lmvworker.min.js",

        ENABLE_DEBUG: true,
        ENABLE_TRACE: false,
        DEBUG_SHADERS: false,
        ENABLE_INLINE_WORKER: true,

        evn: null,
        // GUID of the current active document item.
        docItemId: null,
        // Set viewer in offline mode if set to true. In offline mode, viewer would ignore all URNs in bubble JSON
        // and assume the viewables are laid out in local file system path relative to the bubble.json.
        offline: false,
        // Offline resource prefix specified by viewer consumer (e.g. IOS web view). Used as prefix to concatenate with
        // each resource relative path to form the absolute path of each resource.
        offlineResourcePrefix: null,
        token: {
            accessToken: null,
            getAccessToken: null,
            tokenRefreshInterval: null
        },

        config: {
            userName: ''
        },


        FRAGS_PERSISTENT_COUNT: FRAGS_PERSISTENT_COUNT,
        FRAGS_PERSISTENT_MAX_COUNT: FRAGS_PERSISTENT_MAX_COUNT,
        GEOMS_COUNT_LIMIT: GEOMS_COUNT_LIMIT,


        // If true, will use a different code path where data structures are
        // optimized for using less memory.
        memoryOptimizedLoading: memoryOptimizedLoading,
        // Options for limit memory usage.
        // 1. On demand loading will delay geometry pack file loading,
        //    until rendering need it.
        // 2. As one geometry pack file can contain many meshes that will
        //    be used by a lot of fragments, so can even dismiss those meshes
        //    that are culled by current rendering.
        // 3. Page out geometry acutally will remove some geometry out of core,
        //    so as to free more memory for further rendering.
        // ??? These options will impact rendering performance.
        onDemandLoading: onDemandLoading,
        cullGeometryOnLoading: true && onDemandLoading,
        pageOutGeometryEnabled: true && onDemandLoading,
        PAGEOUT_SUCCESS: 0,
        PAGEOUT_FAIL: 1,
        PAGEOUT_NONE: 2,
        PAGEOUT_PERCENTAGE: PAGEOUT_PERCENTAGE,
        GEOMS_PAGEOUT_COUNT: GEOMS_COUNT_LIMIT * PAGEOUT_PERCENTAGE,

        // A list of resources that record the URL and necessary auxilary information (such as ACM headers and / or
        // session id) required to get the resource. This bag of collection will be passed from JS to native code so
        // all viewer consumable resources could be downloaded on native side for offline viewing.
        // assets = isAndroidDevice() ? [] : null;
        assets: [],


        
        GPU_MEMORY_LIMIT: 256 * 1024 * 1024,
        GPU_OBJECT_LIMIT: 10000,

        DefaultLightPreset: 1,
        DefaultLightPreset2d: 0,

        RENDER_NORMAL: 0,//=== RenderQueue.NORMAL !!!
        RENDER_HIGHLIGHTED: 1,//=== RenderQueue.HIGHLIGHTED !!!
        RENDER_HIDDEN: 2,//=== RenderQueue.HIDDEN !!!
        RENDER_FINISHED: 3,

        OUTSIDE: 0,
        INTERSECTS: 1,
        CONTAINS: 2,
        //web worker used for image processing, etc.
        imageWorker: null,

        EnvironmentConfigurations: {
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
        },
        //error部分
        WEBGL_HELP_LINK: null,
        ErrorInfoData: {
            // UNKNOWN FAILURE
            1: {
                'img': "img-reload",                  // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-UnknownFailure",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message> " +
                                         "<hint>Try loading the item again. </hint>" +
                                         "<hint>Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // BAD DATA
            2: {
                'img': "img-unsupported",             // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-BadData",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>The item you are trying to view was not processed completely. </message>" +
                                          "<hint>Try loading the item again.</hint>" +
                                          "<hint>Please upload the file again to see if that fixes the issue.</hint>"
            },
    
            // NETWORK ERROR
            3: {
                'img': "img-reload",                   // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-NetworkError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                          "<hint> Try loading the item again.</hint>" +
                                          "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // NETWORK_ACCESS_DENIED
            4: {
                'img': "img-unloack",                   // "icons/error_unlock_upload.png",
                'globalized-msg': "Viewer-AccessDenied",
                'default-msg': "<title> No access </title>" +
                                    "<message>Sorry. You don’t have the required privileges to access this item.</message>" +
                                           "<hint> Please contact the author</hint>"
            },
    
            // NETWORK_FILE_NOT_FOUND
            5: {
                'img': "img-item-not-found",            //"icons/error_item_not_found.png",
                'globalized-msg': "Viewer-FileNotFound",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We can’t display the item you are looking for. It may not have been processed yet. It may have been moved, deleted, or you may be using a corrupt file or unsupported file format.</message>" +
                                       "<hint> Try loading the item again.</hint>" +
                                       "<hint> Please upload the file again to see if that fixes the issue.</hint>" +
                                       '<hint> <a href="http://help.autodesk.com/view/ADSK360/ENU/?guid=GUID-488804D0-B0B0-4413-8741-4F5EE0FACC4A" target="_blank">See a list of supported formats.</a></hint>'
            },
    
            // NETWORK_SERVER_ERROR
            6: {
                'img': "img-reload",                    // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-ServerError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                           "<hint> Try loading the item again.</hint>" +
                                           "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
    
            // NETWORK_UNHANDLED_RESPONSE_CODE
            7: {
                'img': "img-reload",                    // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-UnhandledResponseCode",
                'default-msg': "<title> Network problem </title>" +
                                    "<message>Sorry. We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                       "<hint> Try loading the item again.</hint>" +
                                       "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // BROWSER_WEBGL_NOT_SUPPORTED
            8: {
                'img': "img-unsupported",               // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-WebGlNotSupported",
                'default-msg': "<title>Sorry</title><message>We can't show this item because this browser doesn't support WebGL.</message><hint>Try Google Chrome, Mozilla Firefox, or another browser that supports WebGL 3D graphics.</hint><hint>For more information, see the <a href=\"WEBGL_HELP\" target=\"_blank\">A360 browser reqirements.</a></hint>"
            },
    
            // BAD_DATA_NO_VIEWABLE_CONTENT
            9: {
                'img': "img-item-not-found",            // "icons/error_item_not_found.png",
                'globalized-msg': "Viewer-NoViewable",
                'default-msg': "<title> No viewable content </title>" +
                                    "<message>There’s nothing to display for this item. It may not have been processed or it may not have content we can display.</message>" +
                                           "<hint> Please contact the author.</hint>" +
                                           "<hint> Please upload the file again to see if that fixes the issue.</hint>"
            },
    
            // BROWSER_WEBGL_DISABLED
            10: {
                'img': "img-unsupported",              // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-WebGlDisabled",
                'default-msg': "<title>Sorry</title><message>We can't show this item because WebGL is disabled on this device.</message><hint> For more information see the <a href=\"WEBGL_HELP\" target=\"_blank\">A360 Help.</a></hint>"
            },
    
            // RTC_ERROR
            11: {
                'img': "img-unsupported",              // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-RTCError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We couldn’t connect to the Collaboration server.</message>" +
                                    "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            }
        },
    
        currentError: null,
        currentErrors: null
    }
});