define([
    './getParameterByName',
    '../Global',
    '../../Global',
    './refreshToken',
    './getParameterByName',
    '../../Logger'
], function(
    getParameterByName,
    Privite_Global,
    Global,
    refreshToken,
    getParameterByName,
    Logger
) {;
    'use strict'
    var initializeAuth = function (onSuccessCallback, options) {
        
        var shouldInitializeAuth = options ? options.shouldInitializeAuth : undefined;
        if (shouldInitializeAuth === undefined) {
            var p = getParameterByName("auth");
            shouldInitializeAuth = (p.toLowerCase() !== "false");
        }

        //Skip Auth in case we are serving the viewer locally
        if (Privite_Global.env == "Local" || !shouldInitializeAuth) {
            setTimeout(onSuccessCallback, 0);
            auth = false;
            return auth;
        }

        //For Node.js, we will use the Authorization header instead of cookie
        if (Global.isNodeJS)
            LMV_THIRD_PARTY_COOKIE = false;

        // Keep this to make existing client code happy.
        auth = true;

        var accessToken;
        if (options && options.getAccessToken) {
            function onGetAccessToken(token /* access token value. */, expire /* expire time, in seconds. */) {
                accessToken = token;
                refreshToken(accessToken, Privite_Global.token.tokenRefreshInterval ? null /* If this is a token refresh call,
                    don't invoke the onSuccessCallback which will loadDocument and so on. */
                    : onSuccessCallback);
                var interval = expire - 60; // Refresh 1 minute before token expire.
                if (interval <= 0) {
                    // We can't get a precise upper bound if the token is such a short lived one (expire in a minute),
                    // so just use the original one.
                    interval = expire;
                }
                Privite_Global.token.tokenRefreshInterval = interval * 1000;
                setTimeout(function () { options.getAccessToken(onGetAccessToken) }, Privite_Global.token.tokenRefreshInterval);
            }
            Privite_Global.token.getAccessToken = options.getAccessToken;

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

        return auth;
    };

    return initializeAuth;
});