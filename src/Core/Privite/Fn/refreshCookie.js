define(['../Global', '../../Global'], function(Privite_Global, Global) {;
    'use strict'
    var refreshCookie = function (token, onSuccess, onError) {
        
        var xhr = new XMLHttpRequest();
        xhr.onload = onSuccess;
        xhr.onerror = onError;
        xhr.ontimeout = onError;

        // We support two set token end points, the native VS end point and the wrapped apigee end point.
        if (Privite_Global.env.indexOf('Autodesk') === 0) {
            // This really sucks, as Apigee end points use different naming pattern than viewing service.
            var url = Privite_Global.EnvironmentConfigurations[Privite_Global.env].ROOT;

            xhr.open("POST", url + "/utility/v1/settoken", true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.withCredentials = true;

            xhr.send("access-token=" + token);

            // Here we control whether to go through IE 11's authentication code path or not.
            if (Global.isIE11) {
                Privite_Global.accessToken = token;
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
});