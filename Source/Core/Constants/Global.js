define(['./DeviceType'], function(DeviceType) {;
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
    
    var LMV_WORKER_URL = "lmvworker.min.js";
    var ENABLE_INLINE_WORKER = true;
    return {
        BUILD_LMV_WORKER_URL: "lmvworker.min.js",
        LMV_WORKER_URL: LMV_WORKER_URL,

        ENABLE_DEBUG: true,
        ENABLE_TRACE: false,
        DEBUG_SHADERS: false,
        ENABLE_INLINE_WORKER: ENABLE_INLINE_WORKER,

        


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
        WEBGL_HELP_LINK: null,

        HTTP_REQUEST_HEADERS: {},

        auth: null,
        VIEWING_URL: undefined,  //TODO
        ACM_SESSION_URL: undefined,
        OSS_URL: undefined,
        PROTEIN_ROOT: null,
        PRISM_ROOT: null,
        LOCALIZATION_REL_PATH: "",
        LMV_VIEWER_VERSION: "2.8",  // Gets replaced with content from deployment/package.json
        LMV_VIEWER_PATCH: "46",// Gets replaced with build number from TeamCity
        LMV_BUILD_TYPE: "Production", // Either Development, Staging or Production
        LMV_RESOURCE_VERSION: null,
        LMV_RESOURCE_ROOT: "",
        LMV_THIRD_PARTY_COOKIE: undefined,
        LMV_WORKER_URL: LMV_WORKER_URL || "src/workers/MainWorker-web.js",
        ENABLE_INLINE_WORKER: ENABLE_INLINE_WORKER || false,

        WORKER_DATA_URL: null,


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

        LogLevels: {
            DEBUG: 5,
            LOG: 4,
            INFO: 3,
            WARNING: 2,
            ERROR: 1,
            NONE: 0
        }
    }
});