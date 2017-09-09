define(function() {;
    'use strict'
    return {
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
        }
    }
});