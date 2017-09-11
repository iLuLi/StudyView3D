define([
    '../Extension',
    './CommentFactory',
    './CommentService',
    '../../Core/Manager/theExtensionManager'
], function(Extension, CommentFactory, CommentService, theExtensionManager) {
    'use strict';
    var EXTENSION_NAME = 'Autodesk.Comments';

    /**
     * Extension that encapsulates functionality to create AJAX calls to
     * a commenting endpoint for POST/GET/DELETE comment operations.<br>
     *
     * Default [Comment Service]{@link https://developer.autodesk.com/api/comments/internal/}.
     *
     * Notice that most of the exposed functions return a
     * [Promise](@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) object.
     * This component doesn't force usage of any particular Promise library;
     * developers are free to polyfill it as desired.<br>
     *
     * Comments extension was tested with [es6-promise]{@link https://github.com/jakearchibald/es6-promise}
     * which is included as a build artifact (/es6-promise.js and /es6-promise.min.js).
     *
     * @example
     *      // Load extension
     *      // NOTE: You'll need to apply proper values below.
     *      var loadOptions = {
     *          oauth2token: "DKCmo1QIKYGpCywZCjib0wRt9YZi",
     *          urn: "dXJuOmFkc2suY29sdW1idXMuc3RhZ2luZzpmcy5maWxlOmQzNjhjMTdlLWVlMzYtMTFlNC04ZTM5LWRhMTVmYzJhMDc5YT92ZXJzaW9uPTE="
     *      };
     *      viewer.loadExtension("Autodesk.Viewing.Comments", loadOptions);
     *
     *      // Get extension
     *      var extension = viewer.getExtension("Autodesk.Viewing.Comments");
     *
     *      // Get comments, restore 1 comment
     *      var promiseGet = extension.getComments();
     *      promiseGet.then(function(responseWithComments){
     *          console.log("Existing comments are: " + responseWithComments);
     *
     *          var serverComments = JSON.parse(responseWithComments);
     *          if (serverComments.length) {
     *              // Grab the first one and restore it
     *              var firstComment = serverComments[0];
     *              extension.restoreComment(firstComment);
     *          }
     *      });
     *
     *      // Create comment object
     *      var postData = { message: "This is my optional text" };
     *      var promiseCreate = extension.createComment(postData);
     *      promiseCreate.then(function(lmvComment){
     *          return extension.postComment(lmvComment); // Returns another Promise
     *      }).then(function(postedComment){
     *          console.log("Posted comment is: " + postedComment);
     *      });
     *
     * @class
     * @param {Autodesk.Viewing.Viewer3D} viewer - Viewer instance
     * @param {Object} options - Dictionary with options
     * @param {String} options.url - identifier that groups comments together.
     * @param {String} options.oauth2token - 3-legged Oauth 2 token used to access endpoints. Refresh its value through [setToken()]{@link Autodesk.Viewing.Comments.CommentsExtension#setToken}.
     * @param {Boolean} [options.fakeServer] - Forces the usage of a local proxy for all async operations with endpoints. Great for testing.
     * @param {Number} [options.fakeSeverDelay] - Forced delay for fakeServer proxy. Useful to test high/low latency ops. Great for testing.
     *
     * @memberof Autodesk.Viewing.Comments
     * @alias Autodesk.Viewing.Comments.CommentsExtension
     * @extends Autodesk.Viewing.Extension
     * @constructor
     */
    function CommentsExtension(viewer, options) {
        Extension.call(this, viewer, options);
    }

    CommentsExtension.prototype = Object.create(Extension.prototype);
    CommentsExtension.prototype.constructor = CommentsExtension;
    var proto = CommentsExtension.prototype;

    // Extension interface //

    proto.load = function () {

        // Extension requires Promises; check for them
        try {
            var tmp = new Promise(function (resolve, reject) { }); // Check class exists
        } catch (exeption) {
            return false;
        }

        this.factory = new CommentFactory(this.viewer);
        this.commentService = new CommentService(this.viewer);
        return this.commentService.init(this.options);
    };

    proto.unload = function () {
        if (this.commentService) {
            this.commentService.destroy();
            this.commentService = null;
        }
        if (this.factory) {
            this.factory.destroy();
            this.factory = null;
        }
        return true;
    };

    // Public interface //

    /**
     * Set the geometryItem to enhance
     * [createComment()]{@link Autodesk.Viewing.Comments.CommentsExtension#createComment}
     * so that it injects sheet data.
     * See [getSubItemsWithProperties()]{@link Autodesk.Viewing.Document.getSubItemsWithProperties} for more info on items.
     *
     * @param {Object} item - Data object that gives additional info on the loaded model.
     */
    CommentsExtension.prototype.setGeometryItem = function (item) {
        this.factory.geometryItem = item;
    };

    /**
     * Creates a comment object that can be posted to the Comment Service endpoint.<br>
     * Example, user could perform:
     * ```
     * commentExtension.postComment(commentExtension.createComment());
     * ```
     * See also: [postComment()]{@link Autodesk.Viewing.Comments.CommentsExtension#postComment},
     * [restoreComment()]{@link Autodesk.Viewing.Comments.CommentsExtension#restoreComment}
     * @param {Object|String} [data] - Object bag with additional comment values. Or only a String value for the message.
     * @param {Array} [data.message] - Text attached to the comment. Example: "Hi there, this is a comment!".
     * @param {Array} [data.point3d] - Specific 3d point in the geometry (in lmv coordinates). Example [20.5, -5.2, 7.15]
     *
     * @return {Promise}
     */
    CommentsExtension.prototype.createComment = function (data) {
        var aux = data || {};
        // First argument can be just the "message" string
        if (typeof data === "string") {
            aux = { message: data };
        }
        var commentObj = this.factory.createCommentObj(aux);
        return this.factory.exportCommentObj(commentObj);
    };

    /**
     * Wrapper for [restoreState()]{@link Autodesk.Viewing.Viewer3D#restoreState}.
     * Works with objects created from [createComment()]{@link Autodesk.Viewing.Viewer3D#createComment}.
     *
     * @param {Object} commentObj - The comment object, which is a super set of a valid Viewer State object.
     * @param {Object} [filter] - Similar in structure to viewerState used to filter out values
     *                            that should not be restored. Passing no filter will restore all values.
     * @param {Boolean} [immediate] - Whether the state should be apply with (false)
     *                                or without (true) a smooth transition
     * @return {Promise}
     */
    CommentsExtension.prototype.restoreComment = function (commentObj, filter, immediate) {
        var self = this;
        return new Promise(function (resolve) {
            var prom = self.factory.importCommentObj(commentObj);
            prom.then(function (transformed) {
                self.viewer.restoreState(transformed, filter, immediate);
                resolve(transformed);
            });
        });
    };

    /**
     * Sets a token to be used for all endpoint operations
     * @param {String} token - 3-legged Auth2 token
     */
    CommentsExtension.prototype.setToken = function (token) {
        this.commentService.setToken(token);
    };

    /**
     * Sets the REST endpoint's id which groups comments
     * @param {String} path - This of it as the folder name that contains comments
     */
    CommentsExtension.prototype.setPathStorage = function (path) {
        if (!path) {
            throw new Error(EXTENSION_NAME + ": Invalid path storage");
        }
        this.commentService.setPathStorage(path);
    };

    /**
     * Fetches all comments from the Comments Service.
     * Relies on options.url and options.oauth2token passed from constructor.
     * See also: [restoreComment()]{@link Autodesk.Viewing.Comments.CommentsExtension#restoreComment}
     *
     * @return {Promise}
     */
    CommentsExtension.prototype.getComments = function () {
        return this.commentService.listComments();
    };

    /**
     * Post a comment to the Comment Service backend.<br>
     * See also: [createComment()]{@link Autodesk.Viewing.Comments.CommentsExtension#createComment}
     *
     * @param {Object} comment - Object to post (will get JSON.stringify())
     * @param {Array} [xhrHeaders] - Array of {name:String, value:String} for additional header insertion
     * @return {Promise}
     */
    CommentsExtension.prototype.postComment = function (comment, xhrHeaders) {
        return this.commentService.postComment(comment, xhrHeaders)
    };

    /**
     * Posts a comments reply. A reply has the same structure as the one required for postComment()
     *
     * @param {Object} commentReply - Object to post as a reply (will get JSON.stringify())
     * @param {String} parentCommentId - Id of the comment replying to.
     * @return {Promise}
     */
    CommentsExtension.prototype.postCommentReply = function (commentReply, parentCommentId) {
        return this.commentService.postCommentReply(commentReply, parentCommentId);
    };

    /**
     * Deletes a comments from the Comment Service backend
     * @param {String} commentId - id of the comment to remove
     * @return {Promise}
     */
    CommentsExtension.prototype.deleteComment = function (commentId) {
        return this.commentService.deleteComment(commentId);
    };

    /**
     * Deletes a comment reply. Under the hood, it is the same call as deleteComment()
     * @param commentReplyId
     * @return {Promise}
     */
    CommentsExtension.prototype.deleteCommentReply = function (commentReplyId) {
        return this.deleteComment(commentReplyId);
    };

    /**
     * Used to get an OSS location where to post a new attachment.<br>
     * NOTE: Method does not support Promise return value yet.
     *
     * @param {Array} additionalHeaders - Additional request headers
     * @param {Object} callbacks - {onLoad:Function, onError:Function, onTimeout:Function}
     */
    CommentsExtension.prototype.fetchLocationForNewOssAttachment = function (additionalHeaders, callbacks) {
        // TODO: Promisify method //
        return this.commentService.fetchLocationForNewOssAttachment(additionalHeaders, callbacks);
    };

    /**
     * Helps extracting information after calling
     * [fetchLocationForNewOssAttachment()]{@link Autodesk.Viewing.Comments.CommentsExtension#fetchLocationForNewOssAttachment}.
     *
     * @param {String} ossUrn - value returned from fetchLocationForNewOssAttachment()
     * @returns {Array} with 2 String elements: [ bucket_id, attachment_id ]
     */
    CommentsExtension.prototype.extractOssBucketAndId = function (ossUrn) {
        return this.commentService.extractOssBucketAndId(ossUrn);
    };

    /**
     * Posts an attachment to the attachments endpoint (OSS v1 by default).<br>
     * Relies on the return value of
     * [fetchLocationForNewOssAttachment()]{@link Autodesk.Viewing.Comments.CommentsExtension#fetchLocationForNewOssAttachment}.<br>
     * Use [extractOssBucketAndId()]{@link Autodesk.Viewing.Comments.CommentsExtension#extractOssBucketAndId}
     * to extract data out of it.<br>
     * NOTE: Method does not support Promise return value yet.
     *
     * @param {String} objectKey - attachment's id.
     * @param {String|*} fileData - attachment data to post
     * @param {String} bucketId - Id of the OSS bucket where to post the attachment
     * @param {Array} [additionalHeaders] - Additional request headers
     * @param {Object} callbacks - {onLoad:Function, onError:Function, onTimeout:Function}
     */
    CommentsExtension.prototype.postAttachment = function (objectKey, fileData, bucketId, additionalHeaders, callbacks) {
        // TODO: Promisify method //
        return this.commentService.postAttachment(objectKey, fileData, bucketId, additionalHeaders, callbacks);
    };

    /**
     * Initiates an async op to request an attachment from the attachments endpoint (OSS by default).
     * Returns a promise.
     *
     * @param {String} urn -
     * @param {Boolean} isBinary - Whether we are fetching binary data or not
     * @param {Array} [additionalHeaders] - Additional request headers
     * @returns {Promise}
     */
    CommentsExtension.prototype.getAttachment = function (urn, isBinary, additionalHeaders) {
        return this.commentService.getAttachment(urn, isBinary, additionalHeaders);
    };

    theExtensionManager.registerExtension(EXTENSION_NAME, CommentsExtension);
    return CommentsExtension;
});