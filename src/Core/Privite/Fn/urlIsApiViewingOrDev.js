define(function() {;
    'use strict'
    return function (url) {
        // Dev API endpoints
        return url.indexOf('developer.api.autodesk.com') !== -1 ||
                url.indexOf('developer-stg.api.autodesk.com') !== -1 ||
                url.indexOf('developer-dev.api.autodesk.com') !== -1 ||
                // Viewing API endpoints
                url.indexOf('viewing.api.autodesk.com') !== -1 ||
                url.indexOf('viewing-staging.api.autodesk.com') !== -1 ||
                url.indexOf('viewing-dev.api.autodesk.com') !== -1;
    };
});