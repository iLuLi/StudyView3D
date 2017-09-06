define(function() {;
    'use strict'
    // Refresh the token in request header, in case that the third party cookie is disabled
    var refreshRequestHeader = function (token) {

        av.HTTP_REQUEST_HEADERS["Authorization"] = "Bearer " + token;

    };

    return refreshRequestHeader;
});