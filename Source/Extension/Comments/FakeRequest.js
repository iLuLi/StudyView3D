define(function () {
    'use strict';
    /**
     * Helper class that serves as a debug-proxy for async operations.
     * Useful when in development mode and having trouble accessing endpoints.
     *
     * @param {Object} options
     * @param {Number} [options.fakeSeverDelay] - Forced delay on async callbacks (in milliseconds)
     * @param {String} [options.displayName] - User name posting a comment
     * @param {String} [options.oxygenId] - User's oxygenId when posting a comment
     * @constructor
     */
    function FakeRequest(options) {

        this.options = options || {};
        this.FAKE_SERVER_DELAY = this.options.fakeSeverDelay || 200;
        this.FAKE_NEXT_ID = 11;
    }

    var proto = FakeRequest.prototype;

    proto.createRequest = function (operation, url, callbacks, callerFunction) {

        var self = this;
        var fakeRequest = {
            notifyCallback: function (fakeServerResponse) {
                if (self.FAKE_SERVER_DELAY) {
                    // Fake server response delay
                    setTimeout(function () {
                        callbacks.onLoad(fakeServerResponse);
                    },
                        self.FAKE_SERVER_DELAY);
                }
                else {
                    // invoke callback right away
                    callbacks.onLoad(fakeServerResponse);
                }
            },
            replyPostComment: function (args) {
                var dbComment = JSON.parse(args);
                dbComment.id = self.FAKE_NEXT_ID++;
                dbComment.index = dbComment.id;
                dbComment.layoutName = dbComment.layoutName || "Another Sheet";
                if (!dbComment.actor) {
                    dbComment.actor = {
                        name: self.options.displayName || "John Doe",
                        id: self.options.oxygenId || 'ABCDEFGHIJK'
                    };
                }
                dbComment.published = new Date().toUTCString();
                this.notifyCallback({ currentTarget: { status: 200, responseText: JSON.stringify(dbComment) } });
            },
            replyFetchLocationForNewOssAttachment: function () {
                var responseObject = {
                    attachment: [{ url: "urn:adsk.objects:os.object:comments/filename" }]
                };
                this.notifyCallback({ currentTarget: { status: 200, responseText: JSON.stringify(responseObject) } });
            },

            send: function (args) {

                switch (operation) {
                    case 'GET': //listComments
                        this.notifyCallback({ currentTarget: { status: 200, responseText: "[]" } });
                        break;
                    case 'POST': //postComment or postCommentReply

                        switch (callerFunction) {
                            case "fetchLocationForNewOssAttachment":
                                this.replyFetchLocationForNewOssAttachment();
                                break;
                            default:
                                this.replyPostComment(args);
                                break;
                        }
                        break;

                    case 'DELETE': //deleteComment or deleteCommentReply
                        this.notifyCallback({ currentTarget: { status: 200, responseText: "{}" } });
                        break;
                    case 'PUT':
                        try {
                            JSON.parse(args);
                            this.notifyCallback({ currentTarget: { status: 200, responseText: args } });
                        }
                        catch (error) {
                            // send attachmentData
                            var attachmentResponse = {
                                objects: [{ id: "test", key: "test", 'content-type': "image/png", location: "http://www.autodesk.com" }]
                            };

                            this.notifyCallback({ currentTarget: { status: 200, responseText: JSON.stringify(attachmentResponse) } });
                        }
                        break;
                }
            },
            setRequestHeader: function () { }
        };
        return fakeRequest;
    };

    return FakeRequest;
});