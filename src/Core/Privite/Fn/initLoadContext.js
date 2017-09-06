define(['../../Global', ], function(Global) {;
    'use strict'
    var initLoadContext = function (inputObj) {
        
        inputObj = inputObj || {};

        inputObj.auth = auth;
        inputObj.viewing_url = VIEWING_URL;
        inputObj.oss_url = OSS_URL;

        if (!inputObj.headers)
            inputObj.headers = {};

        for (var p in Global.HTTP_REQUEST_HEADERS) {
            inputObj.headers[p] = Global.HTTP_REQUEST_HEADERS[p];
        }

        return inputObj;
    };

    return initLoadContext;
});