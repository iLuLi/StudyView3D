define(function() {;
    'use strict'
    return {
        ErrorInfoData: {
            // UNKNOWN FAILURE
            1: {
                'img': "img-reload",                  // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-UnknownFailure",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message> " +
                                         "<hint>Try loading the item again. </hint>" +
                                         "<hint>Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // BAD DATA
            2: {
                'img': "img-unsupported",             // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-BadData",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>The item you are trying to view was not processed completely. </message>" +
                                          "<hint>Try loading the item again.</hint>" +
                                          "<hint>Please upload the file again to see if that fixes the issue.</hint>"
            },
    
            // NETWORK ERROR
            3: {
                'img': "img-reload",                   // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-NetworkError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                          "<hint> Try loading the item again.</hint>" +
                                          "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // NETWORK_ACCESS_DENIED
            4: {
                'img': "img-unloack",                   // "icons/error_unlock_upload.png",
                'globalized-msg': "Viewer-AccessDenied",
                'default-msg': "<title> No access </title>" +
                                    "<message>Sorry. You don’t have the required privileges to access this item.</message>" +
                                           "<hint> Please contact the author</hint>"
            },
    
            // NETWORK_FILE_NOT_FOUND
            5: {
                'img': "img-item-not-found",            //"icons/error_item_not_found.png",
                'globalized-msg': "Viewer-FileNotFound",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We can’t display the item you are looking for. It may not have been processed yet. It may have been moved, deleted, or you may be using a corrupt file or unsupported file format.</message>" +
                                       "<hint> Try loading the item again.</hint>" +
                                       "<hint> Please upload the file again to see if that fixes the issue.</hint>" +
                                       '<hint> <a href="http://help.autodesk.com/view/ADSK360/ENU/?guid=GUID-488804D0-B0B0-4413-8741-4F5EE0FACC4A" target="_blank">See a list of supported formats.</a></hint>'
            },
    
            // NETWORK_SERVER_ERROR
            6: {
                'img': "img-reload",                    // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-ServerError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                           "<hint> Try loading the item again.</hint>" +
                                           "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
    
            // NETWORK_UNHANDLED_RESPONSE_CODE
            7: {
                'img': "img-reload",                    // "icons/error_reload_in_viewer.png",
                'globalized-msg': "Viewer-UnhandledResponseCode",
                'default-msg': "<title> Network problem </title>" +
                                    "<message>Sorry. We seem to have some technical difficulties and couldn't complete your request.</message>" +
                                       "<hint> Try loading the item again.</hint>" +
                                       "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            },
    
            // BROWSER_WEBGL_NOT_SUPPORTED
            8: {
                'img': "img-unsupported",               // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-WebGlNotSupported",
                'default-msg': "<title>Sorry</title><message>We can't show this item because this browser doesn't support WebGL.</message><hint>Try Google Chrome, Mozilla Firefox, or another browser that supports WebGL 3D graphics.</hint><hint>For more information, see the <a href=\"WEBGL_HELP\" target=\"_blank\">A360 browser reqirements.</a></hint>"
            },
    
            // BAD_DATA_NO_VIEWABLE_CONTENT
            9: {
                'img': "img-item-not-found",            // "icons/error_item_not_found.png",
                'globalized-msg': "Viewer-NoViewable",
                'default-msg': "<title> No viewable content </title>" +
                                    "<message>There’s nothing to display for this item. It may not have been processed or it may not have content we can display.</message>" +
                                           "<hint> Please contact the author.</hint>" +
                                           "<hint> Please upload the file again to see if that fixes the issue.</hint>"
            },
    
            // BROWSER_WEBGL_DISABLED
            10: {
                'img': "img-unsupported",              // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-WebGlDisabled",
                'default-msg': "<title>Sorry</title><message>We can't show this item because WebGL is disabled on this device.</message><hint> For more information see the <a href=\"WEBGL_HELP\" target=\"_blank\">A360 Help.</a></hint>"
            },
    
            // RTC_ERROR
            11: {
                'img': "img-unsupported",              // "icons/error_unsupported_file_type.png",
                'globalized-msg': "Viewer-RTCError",
                'default-msg': "<title> Sorry </title>" +
                                    "<message>We couldn’t connect to the Collaboration server.</message>" +
                                    "<hint> Please verify your Internet connection, and refresh the browser to see if that fixes the problem.</hint>"
            }
        },
    
        currentError: null,
        currentErrors: null,

        /**
         * Error code constants
         *
         * These constants will be used in onErrorCallbacks.
         *
         * @enum {number}
         * @readonly
         */
        ErrorCodes: {
            /** An unknown failure has occurred. */
            UNKNOWN_FAILURE: 1,

            /** Bad data (corrupted or malformed) was encountered. */
            BAD_DATA: 2,

            /** A network failure was encountered. */
            NETWORK_FAILURE: 3,

            /** Access was denied to a network resource (HTTP 403) */
            NETWORK_ACCESS_DENIED: 4,

            /** A network resource could not be found (HTTP 404) */
            NETWORK_FILE_NOT_FOUND: 5,

            /** A server error was returned when accessing a network resource (HTTP 5xx) */
            NETWORK_SERVER_ERROR: 6,

            /** An unhandled response code was returned when accessing a network resource (HTTP 'everything else') */
            NETWORK_UNHANDLED_RESPONSE_CODE: 7,

            /** Browser error: webGL is not supported by the current browser */
            BROWSER_WEBGL_NOT_SUPPORTED: 8,

            /** There is nothing viewable in the fetched document */
            BAD_DATA_NO_VIEWABLE_CONTENT: 9,

            /** Browser error: webGL is supported, but not enabled */
            BROWSER_WEBGL_DISABLED: 10,

            /** Collaboration server error */
            RTC_ERROR: 11

        }
    }
});