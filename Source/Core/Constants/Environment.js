define(function() {;
    'use strict'
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
    }
});