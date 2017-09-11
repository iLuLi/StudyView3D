define([
    '../Utils/urlIsApiViewingOrDev',
    '../Constants/Global',
    '../Inits',
    '../Logger',
    './ViewingService'
], function(urlIsApiViewingOrDev, Global, Inits, Logger, ViewingService) {
    'use strict';
    var initLoadContext = Inits.initLoadContext;
    function loadTextureWithSecurity(path, mapping, callback, acmSessionId) {
        
        if (Global.auth) {
            // TODO: We should actually ALSO consider the case where texture is being loaded from
            // the same domain as the SVF being served. With such a change, we will be taking into
            // account developers exposing SVF's through their own proxy servers.
            var useCredentials = path.indexOf('://') === -1 ||
                path.indexOf(window.location.host) !== -1 ||
                urlIsApiViewingOrDev(path);

            if (useCredentials) { //if you're sending to your own host or to autodesk views and data api, then use credentials
                THREE.ImageUtils.crossOrigin = 'use-credentials';
            } else { //otherwise do not
                THREE.ImageUtils.crossOrigin = 'anonymous';
            }
        }

        var index = path.indexOf('urn:');
        if (index !== -1) {

            path = path.substr(0, index) + encodeURIComponent(path.substr(index));

            var domainParam = (auth && !Global.isNodeJS) ? ("domain=" + encodeURIComponent(window.location.origin)) : "";
            var queryParam = domainParam;
            if (acmSessionId) {
                if (queryParam)
                    queryParam += "&";
                queryParam += "acmsession=" + acmSessionId;
            }

            if (queryParam)
                path += "?" + queryParam;
        }

        // If the textures are stored on OSS, directly stream it from OSS instead of going through items API.
        var ossPath = ViewingService.getDirectOSSUrl({ oss_url: Global.OSS_URL }, path);
        if (ossPath)
            path = ossPath;

        if (path.slice(path.length - 4).toLocaleLowerCase() === ".dds") {
            if (Global.isIOSDevice) {
                var pvrPath = path.slice(0, path.length - 4) + ".pvr";
                return new THREE.PVRLoader().load(pvrPath, callback);
            } else {
                return new THREE.DDSLoader().load(path, callback);
            }
        } else if (!Global.LMV_THIRD_PARTY_COOKIE && useCredentials)
            return loadTextureWithToken(path, mapping, callback);
        else
            return THREE.ImageUtils.loadTexture(path, mapping, callback);
    }

    // For texture loading, three.js expects loadable URL for the image.
    // When we put the token in request header instead of cookie, we need AJAX the
    // texture and base64 encode it to create a data URI and feed it to three.js.
    function loadTextureWithToken(path, mapping, callback) {

        var texture = new THREE.Texture(undefined, mapping);

        function onSuccess(data) {
            return loadTextureBinary(data, texture, callback);
        }

        function onFailure(statusCode, statusText, data) {
            var errorMsg = "Error: " + statusCode + " (" + statusText + ")";
            Logger.error(errorMsg);
        }

        ViewingService.getItem(initLoadContext(), path, onSuccess, onFailure);

        return texture;
    }

    function loadTextureBinary(data, texture, callback) {

        function arrayBufferToDataUri(buffer) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }

            var uri = "data:image/jpeg;base64," + window.btoa(binary);
            return uri;
        }

        var image = new Image();
        texture.image = image;

        image.onload = function () {
            texture.needsUpdate = true;
            if (callback) callback(texture);
        };
        image.onerror = function (e) {
            Logger.error(e);
        };

        image.src = arrayBufferToDataUri(data);

    }

    return loadTextureWithSecurity;
});