define(['../Global', './refreshRequestHeader', './refreshCookie'], function(Privite_Global, refreshRequestHeader, refreshCookie) {;
    'use strict'
    var refreshToken = function (token, onSuccess, onError) {
        
        // Store the token, it will be used when third-party cookies are disabled
        Privite_Global.token.accessToken = token;

        // At the beginning, try to store the token in cookie
        if (LMV_THIRD_PARTY_COOKIE === undefined) {
            refreshCookie(token, onSuccess, onError);
        } else {
            doTokenRefresh();
        }

        // if third-party cookies are enabled in browser, then put token in cookie
        // if not, put token into request header
        function doTokenRefresh() {

            if (LMV_THIRD_PARTY_COOKIE) {

                refreshCookie(token, onSuccess, onError);

            } else {

                refreshRequestHeader(token);
                onSuccess();

            }
        }

    };

    return refreshToken;
});