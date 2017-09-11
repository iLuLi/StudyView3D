define([
    '../Constants/Global',
    '../Constants/Error',
    '../Logger'
], function(Global, Error, Logger) {
    'use strict';
    var inWorkerThread = (typeof self !== 'undefined') && (typeof window === 'undefined');

    var XhrConstructor;
    if (typeof XMLHttpRequest !== "undefined") {
        XhrConstructor = XMLHttpRequest;
    } else {
        //Node.js code path
        XhrConstructor = require("xhr2");

        //Patch xhr2 to allow Cookie headers so we can do auth against viewing.api.autodesk.com
        //by faking being a browser
        XhrConstructor.prototype._restrictedHeaders.cookie = false;
    }

    var ViewingService = {};

    var warnedGzip = false;

    // Simplify Unix style file path. For example, turn '/a/./b/../../c/' into "/c".
    // Required to deal with OSS crappy URNs where there are embedded '..'.
    function simplifyPath(path) {

        var elements = path.split('/');
        if (elements.length == 0)
            return path;

        var stack = [];
        for (var index = 0; index < elements.length; ++index) {
            var c = elements[index];
            if (c === '.') {
                continue;
            } if (c === '..' && stack.length) {
                stack.pop();
            } else {
                stack.push(c);
            }
        }

        // Great, the path commits suicide.
        if (stack.length == 0)
            return '';

        return stack.join("/");
    }

    function textToArrayBuffer(textBuffer, startOffset) {
        var len = textBuffer.length - startOffset;
        var arrayBuffer = new ArrayBuffer(len);
        var ui8a = new Uint8Array(arrayBuffer, 0);
        for (var i = 0, j = startOffset; i < len; i++, j++)
            ui8a[i] = (textBuffer.charCodeAt(j) & 0xff);
        return ui8a;
    }


    ViewingService.OSS_PREFIX = "urn:adsk.objects:os.object:";

    ViewingService.getDirectOSSUrl = function (options, path) {
        // When we see a resource is hosted on OSS (by checking the urn prefix where it contain a specific signature),
        // we'll construct the full OSS url that can be used to call the OSS GET object API.
        // The construction process will extract the OSS bucket name (which is the payload between the signature and the first forward slash first enoutered afterwards),
        // and then the object name (which is the payload left). The object name has to be URL encoded because OSS will choke on forward slash.
        var ossIndex = path.indexOf(ViewingService.OSS_PREFIX);
        if (ossIndex !== -1) {
            var ossPath = path.substr(ossIndex + ViewingService.OSS_PREFIX.length);
            var bucket = ossPath.substr(0, ossPath.indexOf("/"));
            var object = ossPath.substr(ossPath.indexOf("/") + 1);
            object = simplifyPath(object);
            var ret = options.oss_url + "/buckets/" + bucket + "/objects/" + encodeURIComponent(decodeURIComponent(object));
            return ret;
        }
    };

    /**
     * Construct full URL given a potentially partial viewing service "urn:" prefixed resource
     * @returns {string}
     */
    ViewingService.generateUrl = function (baseUrl, api, path) {

        path = simplifyPath(path);

        //Check if it's a viewing service item path
        if (path.indexOf('urn:') !== 0)
            return path;

        var res = baseUrl + "/";

        if (api !== 'items') {
            // Remove 'urn:' prefix when calling /items API.
            path = path.substr(4);
        }

        //TODO: WTF... we should not be checking the env parameter like this.
        //Check the endpoint URL for being raw viewing service or something....
        if (api === "bubbles" && Private_Global.env.indexOf('Autodesk') == 0) {
            // The bubbles API for PAAS endpoint (where environment is prefixed with 'Autodesk')
            // has no explicit 'bubble' in the URL path.
            res += path;
        } else {
            res += api + "/" + path;
        }

        return res;
    };

    function isRemotePath(baseUrl, path) {
        if (path.indexOf("file://") !== -1)
            return false;
        if (path.indexOf("://") !== -1)
            return true;
        if (baseUrl)
            return true;
    }

    function loadLocalFile(url, onSuccess, onFailure, options) {

        if (url.indexOf("file://") === 0)
            url = url.substr(7);

        function postProcess(data) {
            if (options.responseType == "json") {
                try {
                    return JSON.parse(data.toString("utf8"));
                } catch (e) {
                    onFailure(e);
                }
            }
            return data;
        }

        //Always use async on Node
        require('fs').readFile(url, function (error, data) {
            if (error) {
                onFailure(0, 0, { httpStatusText: error, url: url });
            } else {
                if (data[0] == 31 && data[1] == 139) {
                    require('zlib').gunzip(data, null, function (error, data) {
                        if (error)
                            onFailure(0, 0, { httpStatusText: error, url: url });
                        else {
                            data = postProcess(data);
                            if (options.ondata)
                                options.ondata(data);
                            onSuccess(data);
                        }
                    });
                } else {
                    data = postProcess(data);
                    if (options.ondata)
                        options.ondata(data);
                    onSuccess(data);
                }
            }
        });
    }

    /**
     *  Performs a GET/HEAD request to Viewing Service.
     *
     * @param {string} viewingServiceBaseUrl - The base url for the viewing service.
     * @param {string} api - The api to call in the viewing service.
     *  @param {string} url - The url for the request.
     *  @param {function} onSuccess - A function that takes a single parameter that represents the response
     *                                returned if the request is successful.
     *  @param {function} onFailure - A function that takes an integer status code, and a string status, which together represent
     *                                the response returned if the request is unsuccessful, and a third data argument, which
     *                                has more information about the failure.  The data is a dictionary that minimally includes
     *                                the url, and an exception if one was raised.
     *  @param {Object=} [options] - A dictionary of options that can include:
     *                               headers - A dictionary representing the additional headers to add.
     *                               queryParams - A string representing the query parameters
     *                               responseType - A string representing the response type for this request.
     *                               {boolean} [encodeUrn] - when true, encodes the document urn if found.
     *                               {boolean} [noBody] - when true, will perform a HEAD request
     */
    ViewingService.rawGet = function (viewingServiceBaseUrl, api, url, onSuccess, onFailure, options) {

        var options = options ? options : {};

        //NODE
        if (Global.isNodeJS && !isRemotePath(viewingServiceBaseUrl, url)) {
            loadLocalFile(url, onSuccess, onFailure, options);
            return;
        }

        //See if it can be mapped to a direct OSS path
        var ossUrl = ViewingService.getDirectOSSUrl(options, url);

        if (ossUrl)
            url = ossUrl;
        else
            url = ViewingService.generateUrl(viewingServiceBaseUrl, api, url);

        if (options.queryParams) {
            url = url + "?" + options.queryParams;
        }

        var request = new XhrConstructor();

        function onError(e) {
            onFailure(request.status, request.statusText, { url: url });
        }

        function onLoad(e) {
            if (request.status === 200) {

                if (request.response
                    && request.response instanceof ArrayBuffer) {
                    var rawbuf = new Uint8Array(request.response);
                    //It's possible that if the Content-Encoding header is set,
                    //the browser unzips the file by itself, so let's check if it did.
                    if (rawbuf[0] == 31 && rawbuf[1] == 139) {
                        if (!warnedGzip) {
                            warnedGzip = true;
                            Logger.warn("An LMV resource (" + url + ") was not uncompressed by the browser. This hurts performance. Check the Content-Encoding header returned by the server and check whether you're getting double-compressed streams. The warning prints only once but it's likely the problem affects multiple resources.");
                        }
                        try {
                            rawbuf = new Zlib.Gunzip(rawbuf).decompress();
                        } catch (err) {
                            onFailure(Error.ErrorCodes.BAD_DATA,
                                        "Malformed data received when requesting file",
                                        { "url": url, "exception": err.toString(), "stack": err.stack });
                        }
                    }

                    onSuccess(rawbuf);
                }
                else {
                    onSuccess(request.response || request.responseText);
                }
            }
            else {
                onError(e);
            }
        }

        try {

            var async = options.hasOwnProperty('asynchronous') ? options.asynchronous : true;
            request.open(options.noBody ? 'HEAD' : 'GET', url, async);

            if (options.hasOwnProperty('responseType')) {
                request.responseType = options.responseType;
            }

            request.withCredentials = true;
            if (options.hasOwnProperty("withCredentials"))
                request.withCredentials = options.withCredentials;

            if (options.headers) {
                for (var header in options.headers) {
                    request.setRequestHeader(header, options.headers[header]);

                    // Disable withCredentials if header is Authorization type
                    // NOTE: using withCredentials attaches cookie data to request
                    if (header.toLocaleLowerCase() === "authorization") {
                        request.withCredentials = false;
                    }
                }
            }

            if (async) {
                request.onload = onLoad;
                request.onerror = onError;
                request.ontimeout = onError;

                if (options.ondata) {

                    //Set up incremental progress notification
                    //if needed. We have to do some magic in order
                    //to get the received data progressively.
                    //https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
                    request.overrideMimeType('text/plain; charset=x-user-defined');
                    options._dlProgress = {
                        streamOffset: 0,
                        counter: 0
                    };

                    request.onreadystatechange = function () {

                        if (request.readyState > 2) {

                            var textBuffer = request.responseText;

                            // No new data coming in.
                            if (options._dlProgress.streamOffset >= textBuffer.length)
                                return;

                            var arrayBuffer = textToArrayBuffer(textBuffer, options._dlProgress.streamOffset);

                            options._dlProgress.streamOffset = textBuffer.length;

                            options.ondata(arrayBuffer);
                        }
                    };
                }
            }

            request.send();

            if (options.skipAssetCallback) {
            } else {
                if (inWorkerThread) {
                    self.postMessage({ assetRequest: [url, options.headers, null /* ACM session id, null in this case. */] });
                } else {
                    Private_Global.assets.push([url, options.headers, null /* ACM session id, null in this case. */]);
                }
            }

            if (!async) {
                onLoad();
            }
        }
        catch (e) {
            onFailure(request.status, request.statusText, { url: url, exception: e });
        }
    };


    // Create the default failure callback.
    //
    ViewingService.defaultFailureCallback = function (httpStatus, httpStatusText, data) {
        if (httpStatus == 403) {
            this.raiseError(
                Error.ErrorCodes.NETWORK_ACCESS_DENIED,
                "Access denied to remote resource",
                { "url": data.url, "httpStatus": httpStatus, "httpStatusText": httpStatusText });
        }
        else if (httpStatus == 404) {
            this.raiseError(
                Error.ErrorCodes.NETWORK_FILE_NOT_FOUND,
                "Remote resource not found",
                { "url": data.url, "httpStatus": httpStatus, "httpStatusText": httpStatusText });
        }
        else if (httpStatus >= 500 && httpStatus < 600) {
            this.raiseError(
                Error.ErrorCodes.NETWORK_SERVER_ERROR,
                "Server error when accessing resource",
                { "url": data.url, "httpStatus": httpStatus, "httpStatusText": httpStatusText });
        }
        else if (data.exception) {
            this.raiseError(
                Error.ErrorCodes.NETWORK_FAILURE,
                "Network failure",
                { "url": data.url, "exception": data.exception.toString(), "stack": data.exception.stack });
        }
        else {
            this.raiseError(
                Error.ErrorCodes.NETWORK_UNHANDLED_RESPONSE_CODE,
                "Unhandled response code from server",
                { "url": data.url, "httpStatus": httpStatus, "httpStatusText": httpStatusText, data: data });
        }
    };



    function copyOptions(loadContext, options) {

        //Those are the usual defaults when called from the LMV worker
        if (!options.hasOwnProperty("asynchronous"))
            options.asynchronous = true;
        else if (!options.asynchronous)
            Logger.warn("LMV: Sync XHR used. Performance warning.");

        if (!options.hasOwnProperty("responseType"))
            options.responseType = "arraybuffer";

        //Add options junk we got from the main thread context
        options.withCredentials = !!loadContext.auth;
        options.headers = loadContext.headers;
        options.queryParams = loadContext.queryParams;
        options.oss_url = loadContext.oss_url;
    }

    //Utility function called from the web worker to set up the options for a get request,
    //then calling ViewingService.get internally
    ViewingService.getItem = function (loadContext, url, onSuccess, onFailure, options) {

        options = options || {};

        copyOptions(loadContext, options);

        ViewingService.rawGet(loadContext.viewing_url, 'items', url, onSuccess, onFailure, options);

    };

    //Utility function called from the web worker to set up the options for a get request,
    //then calling ViewingService.get internally
    ViewingService.getManifest = function (loadContext, url, onSuccess, onFailure, options) {

        options = options || {};

        if (!options.hasOwnProperty("responseType"))
            options.responseType = "json";

        copyOptions(loadContext, options);

        ViewingService.rawGet(loadContext.viewing_url, 'bubbles', url, onSuccess, onFailure, options);

    };

    //Utility function called from the web worker to set up the options for a get request,
    //then calling ViewingService.get internally
    ViewingService.getThumbnail = function (loadContext, url, onSuccess, onFailure, options) {

        options = options || {};

        copyOptions(loadContext, options);

        if (!options.queryParams) {
            var role = options.role || "rendered";
            var sz = options.size || 400;
            options.queryParams = "guid=" + encodeURIComponent(options.guid) + "&role=" + role + "&width=" + sz + "&height=" + sz;
        }

        ViewingService.rawGet(loadContext.viewing_url, 'thumbnails', url, onSuccess, onFailure, options);

    };


    ViewingService.getACMSession = function (acmUrl, acmProperties, onSuccess, onFailure) {

        var acmHeaders = {};
        var token;

        for (var key in acmProperties) {

            if (key === "oauth2AccessToken")
                token = acmProperties[key];

            else if (key.indexOf("x-ads-acm") !== -1)
                acmHeaders[key] = acmProperties[key];
            if (Global.isMobileDevice()) Global.HTTP_REQUEST_HEADERS = acmHeaders;
        }

        // The value of this can be anything. Required for some arcane reasons.
        acmHeaders.application = "autodesk";

        var xhr = new XMLHttpRequest();
        xhr.open("POST", acmUrl, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.responseType = "json";

        xhr.onload = function () {
            if (xhr.status === 200 && xhr.response) {
                // If the response is a string (e.g. from IE), need to parse it to an object first
                var response = typeof (xhr.response) === 'string' ? JSON.parse(xhr.response) : xhr.response;

                if (response && response.acmsession) {
                    onSuccess(response.acmsession);
                }
                else {
                    onFailure(xhr.status, "Can't get acm session from response.");
                }

            } else {
                onFailure(xhr.status);
            }
        };

        xhr.onerror = onFailure;
        xhr.ontimeout = onFailure;
        xhr.send(JSON.stringify(acmHeaders));

        // "application" header is only required for OSS end point, and should not be passed
        // with normal requests because this header is not in allowed header sets of APIGEE.
        delete acmHeaders.application;

    };

    return ViewingService;
});