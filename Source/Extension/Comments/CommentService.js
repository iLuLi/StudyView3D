define([
    '../../Core/Logger'
], function(Logger) {
    'use strict';
    /**
     * Helper class for CommentsExtension which deals with all async ops with endpoints
     * @constructor
     */
    function CommentService(viewer) {
        this.viewer = viewer;
        this.PATH_STORAGE = null;
        this.CREDENTIALS = {
            OAUTH_2_TOKEN: null
        };
        this.fakeRequest = null;
    }

    var proto = CommentService.prototype;

    proto.ENV_TABLE = {
        Local: {
            COMMENT: 'https://developer-dev.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer-dev.api.autodesk.com/oss/v1/'
        },
        Development: {
            COMMENT: 'https://developer-dev.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer-dev.api.autodesk.com/oss/v1/'
        },
        Staging: {
            COMMENT: 'https://developer-stg.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer-stg.api.autodesk.com/oss/v1/'
        },
        Production: {
            COMMENT: 'https://developer.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer.api.autodesk.com/oss/v1/'
        },
        AutodeskDevelopment: {
            COMMENT: 'https://developer-dev.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer-dev.api.autodesk.com/oss/v1/'
        },
        AutodeskStaging: {
            COMMENT: 'https://developer-stg.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer-stg.api.autodesk.com/oss/v1/'
        },
        AutodeskProduction: {
            COMMENT: 'https://developer.api.autodesk.com/comments/v2/',
            OBJECT_STORAGE: 'https://developer.api.autodesk.com/oss/v1/'
        }
    };

    proto.init = function (options) {

        options = options || {};

        // Environment //
        this.env = Autodesk.Viewing.Private.env;
        if (options.fakeServer) {
            this.fakeRequest = new namespace.FakeRequest(options);
        }

        // End Points //
        var config = this.ENV_TABLE[this.env];
        this.COMMENT_SERVICE_URL = config['COMMENT'];
        this.OBJECT_STORAGE_SERVICE_URL = config['OBJECT_STORAGE'];

        // Credentials
        if (!options.fakeServer && !options.oauth2token) {
            console.warn("[CommentExt]options.oauth2token not found; failed to initialized extension.");
            return false;
        }
        this.setToken(options.oauth2token);

        // Urn
        if (!options.fakeServer && !options.urn) {
            // Grab urn from viewer instance
            var model = this.viewer.model;
            if (model && model.loader) {
                options.urn = model.loader.svfUrn;
                Logger.log("[CommentExt]options.urn not found; auto-detecting: " + options.urn);
            }
            if (!options.urn) {
                Logger.warn("[CommentExt]options.urn not found; failed to initialized extension.");
                return false;
            }
        }
        this.setPathStorage(options.urn);

        return true;
    };

    /**
     * Invoked when extension is unloaded
     */
    proto.destroy = function () {
        this.viewer = null;
        this.fakeRequest = null;
    };

    /**
     * Sets a token to be used for all endpoint operations
     * @param {String} token - 3-legged Auth2 token
     */
    proto.setToken = function (token) {
        this.CREDENTIALS.OAUTH_2_TOKEN = token;
    };

    /**
     * Sets the REST endpoint's id which groups comments
     * @param {String} path - This of it as the folder name that contains comments
     */
    proto.setPathStorage = function (path) {
        this.PATH_STORAGE = path;
    };

    /**
     * Gets all comments from comments endpoint
     *
     * @param {Array} [additionalHeaders] - Additional headers with items {name:String, value:String}
     * @returns {Promise}
     */
    proto.listComments = function (additionalHeaders) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var url = [self.COMMENT_SERVICE_URL, 'resources/', self.PATH_STORAGE].join("");
            var callbacks = getAjaxCallback(resolve, reject);
            var xhr = createRequest(self, 'GET', url, 'text/plain', callbacks);
            injectHeaders(xhr, additionalHeaders);
            xhr.send();
        });
    };

    /**
     * Posts a new comment to the comments endpoint
     *
     * @param {Object} commentObj - Comment object to post
     * @param {Array} [additionalHeaders] - Additional headers with items {name:String, value:String}
     * @returns {Promise}
     */
    proto.postComment = function (commentObj, additionalHeaders) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var url = [self.COMMENT_SERVICE_URL, 'resources/', self.PATH_STORAGE].join("");
            var callbacks = getAjaxCallback(resolve, reject);
            var xhr = createRequest(self, 'POST', url, 'text/plain', callbacks);
            injectHeaders(xhr, additionalHeaders);
            xhr.send(JSON.stringify(commentObj));
        });
    };

    /**
     * Posts a reply to an existing comment in the comment endpoint
     *
     * @param {Object} commentObj - Reply Comment object to post (same structure as a new comment)
     * @param {String} parentCommentId - Comment id which is being replied
     * @param {Array} [additionalHeaders] - Additional headers with items {name:String, value:String}
     * @returns {Promise}
     */
    proto.postCommentReply = function (commentObj, parentCommentId, additionalHeaders) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var base64 = window.encodeURIComponent(base64encode(parentCommentId));
            var url = [self.COMMENT_SERVICE_URL, 'resources/', base64].join("");
            var callbacks = getAjaxCallback(resolve, reject);
            var xhr = createRequest(self, 'POST', url, 'text/plain', callbacks);
            injectHeaders(xhr, additionalHeaders);
            xhr.send(JSON.stringify(commentObj));
        });
    };

    /**
     * Deletes a comment from the comment endpoint.
     * Can be used to delete replies as well.
     *
     * @param {String} commentId - Id of the comment to delete
     * @param {Array} [additionalHeaders] - Additional headers with items {name:String, value:String}
     * @returns {Promise}
     */
    proto.deleteComment = function (commentId, additionalHeaders) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var encodedId = base64encode(commentId);
            var base64 = window.encodeURIComponent(encodedId);
            var url = [self.COMMENT_SERVICE_URL, 'resources/', base64].join("");
            var callbacks = getAjaxCallback(resolve, reject);
            var xhr = createRequest(self, 'DELETE', url, 'text/plain', callbacks);
            injectHeaders(xhr, additionalHeaders);
            xhr.send();
        });
    };

    proto.fetchLocationForNewOssAttachment = function (additionalHeaders, callbacks) {
        var url = [this.COMMENT_SERVICE_URL, 'resources/', this.PATH_STORAGE, '/attachment'].join("");
        var xhr = createRequest(this, 'POST', url, 'application/json', callbacks, "fetchLocationForNewOssAttachment");
        injectHeaders(xhr, additionalHeaders);
        xhr.send();
    };

    proto.getAttachment = function (urn, isBinaryData, additionalHeaders) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var dataParts = self.extractOssBucketAndId(urn);
            var url = [self.OBJECT_STORAGE_SERVICE_URL, 'buckets/', dataParts[0], '/objects/', dataParts[1]].join("");
            var callbacks = getAjaxCallback(resolve, reject, isBinaryData);
            var xhr = createRequest(self, 'GET', url, null, callbacks);
            injectHeaders(xhr, additionalHeaders);
            if (isBinaryData) {
                xhr.responseType = 'arraybuffer';
            }
            xhr.send();
        });
    };

    proto.postAttachment = function (objectKey, fileData, bucketId, additionalHeaders, callbacks) {
        var url = [this.OBJECT_STORAGE_SERVICE_URL, 'buckets/', bucketId, '/objects/', objectKey].join("");
        var xhr = createRequest(this, 'PUT', url, 'text/plain', callbacks);
        injectHeaders(xhr, additionalHeaders);
        xhr.send(fileData);
    };

    proto.deleteAttachment = function (objectKey, bucketId, callbacks) {
        var url = [this.OBJECT_STORAGE_SERVICE_URL, 'buckets/', bucketId, '/objects/', objectKey].join("");
        var xhr = createRequest(this, 'DELETE', url, 'text/plain', callbacks);
        xhr.send();
    };

    /**
     * Extracts the bucket id and the attachment id from an OSS URN.
     * @param {String} ossUrn
     * @returns {Array} With values: [ <bucket_id>, <attachment_id> ]
     */
    proto.extractOssBucketAndId = function (ossUrn) {
        var dataParts = ossUrn.split('/'); // Returns 2 array with 2 elements [ <stuff + bucket_id>, <attachment_id> ]
        var bucketId = dataParts[0];            // Something like 'urn:adsk.objects:os.object:comments'
        var tmpArray = bucketId.split(':');     // We need to get 'comments' at the end.
        dataParts[0] = tmpArray[tmpArray.length - 1];
        return dataParts;
    };

    ///////////////////////
    // Private functions //
    ///////////////////////

    /**
     * Creates a request object to communicate with the comments endpoint.
     * May create a fake request for debug purposes if specified in options.
     * Returned value is ready to initiate async operation through it's send() method
     * (it hasn't been called yet)
     *
     * @param {CommentService} instance
     * @param {String} operation - POST, GET, DELETE
     * @param {String} url - REST endpoint
     * @param {String} contentType - Content type header
     * @param {Object} callbacks - {onLoad:Function, onError:Function, onTimeout:Function}
     * @param {String} [callerFunction] - Name of the operation being performed
     * @returns {XMLHttpRequest}
     */
    function createRequest(instance, operation, url, contentType, callbacks, callerFunction) {

        if (instance.fakeRequest) {
            return instance.fakeRequest.createRequest(operation, url, callbacks, callerFunction);
        }

        var xhr = new XMLHttpRequest();
        xhr.open(operation, url, true);
        if (contentType) {
            xhr.setRequestHeader("Content-Type", contentType);
        }
        xhr.setRequestHeader("Access-Control-Allow-Origin", "*");
        xhr.setRequestHeader("Authorization", "Bearer " + instance.CREDENTIALS.OAUTH_2_TOKEN);
        xhr.onload = callbacks.onLoad;
        xhr.onerror = callbacks.onError;
        xhr.ontimeout = callbacks.onTimeout;
        return xhr;
    }

    /**
     * Returns an object compatible with our AJAX callbacks mechanism.
     * Internal usage only.
     *
     * @param {Function} resolve
     * @param {Function} reject
     * @param {Boolean} [isBinaryData] Whether the response is to be binary or not (defaults to not-binary)
     * @returns {{onLoad: Function, onError: Function, onTimeout: Function}}
     */
    function getAjaxCallback(resolve, reject, isBinaryData) {
        return {
            onLoad: function (event) {
                if (event.currentTarget.status == 200) {
                    resolve(isBinaryData ? event.currentTarget.response
                        : event.currentTarget.responseText);
                } else {
                    reject();
                }
            },
            onError: function () {
                reject();
            },
            onTimeout: function () {
                reject();
            }
        }
    }

    /**
     * Injects additional RequestHeaders before dispatching the async op to the comment endpoint.
     *
     * @param {XMLHttpRequest} xhr
     * @param {Array} additionalHeaders - Additional headers with items {name:String, value:String}
     */
    function injectHeaders(xhr, additionalHeaders) {
        additionalHeaders && additionalHeaders.forEach(function (headerInfo) {
            xhr.setRequestHeader(headerInfo['name'], headerInfo['value']);
        });
    }

    /**
     * Base64 encode function (btoa) with IE9 support
     * @param {String} str - May contain characters with values beyond ascii
     * @returns {String} ascii-only encoded string
     */
    function base64encode(str) {
        if (window.btoa) {
            return window.btoa(str);
        }
        // IE9 support
        return window.Base64.encode(str);
    }

    return CommentService;
});