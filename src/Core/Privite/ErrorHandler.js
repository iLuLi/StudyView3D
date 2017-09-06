define([
    '../Global',
    '../Logger',
    './Global',
    '../../i18n',
    '../../Widget/AlertBox'
], function(Global, Logger, Privite_Global, i18n, AlertBox) {
    'use strict';
    var ErrorHandler = function () {
    };

    ErrorHandler.prototype.constructor = ErrorHandler;

    ErrorHandler.getErrorCode = function (networkStatus) {
        if ((networkStatus === 403) || (networkStatus === 401)) {
            return Global.ErrorCodes.NETWORK_ACCESS_DENIED;
        }
        else if (networkStatus === 404) {
            return Global.ErrorCodes.NETWORK_FILE_NOT_FOUND;
        }
        else if (networkStatus >= 500) {
            return Global.ErrorCodes.NETWORK_SERVER_ERROR;
        }
        return Global.ErrorCodes.NETWORK_UNHANDLED_RESPONSE_CODE;
    };

    ErrorHandler.reportError = function (container, errorCode, errorMsg, statusCode, statusText, errorType) {
        ErrorHandler.currentError = null;
        ErrorHandler.currentErrors = null;

        // If there is no errorCode, just return (otherwise an empty alert box is being shown)
        if (!errorCode)
            return;

        var errorLog = {
            category: "error",
            code: errorCode,
            message: errorMsg,
            httpStatusCode: statusCode,
            httpStatusText: statusText
        };
        Logger.track(errorLog, true);

        ErrorHandler.currentError = [container, errorCode, errorMsg, errorType];

        var errorInfo = Privite_Global.ErrorInfoData[errorCode];
        if (errorInfo) {
            var options = {
                "defaultValue": ""
            };

            options.defaultValue = errorInfo['default-msg'];
            var imgClass = errorInfo["img"];
            var errorGlobalizedMsg = errorInfo['globalized-msg'];

            var error = this.parseErrorString(errorGlobalizedMsg, options);

            if (errorCode === Global.ErrorCodes.BROWSER_WEBGL_DISABLED ||
                errorCode === Global.ErrorCodes.BROWSER_WEBGL_NOT_SUPPORTED) {
                var WEBGL_HELP_LINK = Privite_Global.WEBGL_HELP_LINK || "http://www.autodesk.com/a360-browsers";

                for (var i = 0; i < error.hints.length; i++) {
                    var index = error.hints[i].indexOf('href="WEBGL_HELP"');
                    if (index !== -1) {
                        error.hints[i] = error.hints[i].replace('href="WEBGL_HELP"', 'href="' + WEBGL_HELP_LINK + '"');
                    }
                }
            }

            AlertBox.displayError(container, error.msg, error.header, imgClass, error.hints);
        }
        else {
            var imgClass = "img-unsupported"; // "icons/error_unsupported_file_type.png";

            var options = {
                "defaultValue": "",
                "interpolationPrefix": "{",
                "interpolationSuffix": "}"
            };

            this.parseArguments(errorMsg, options);
            var error = this.parseErrorString(errorCode, options);

            if (!error.header)
                error.header = (errorType === "warning") ? Autodesk.Viewing.i18n.translate("header-warning") : "";
            AlertBox.displayError(container, error.msg, error.header, imgClass, error.hints);
        }
    };

    ErrorHandler.reportErrors = function (container, errors) {
        ErrorHandler.currentError = null;
        ErrorHandler.currentErrors = null;

        if (!errors)
            return;

        ErrorHandler.currentErrors = [container, errors];

        var options = {
            "defaultValue": "",
            "interpolationPrefix": "{",
            "interpolationSuffix": "}"
        };

        var formattedErrors = [];
        for (var i = 0; i < errors.length; i++) {
            if (!errors[i].code)
                continue;

            this.parseArguments(errors[i].message, options);

            var error = this.parseErrorString(errors[i].code, options);
            if (!error.header)
                error.header = (errors[0].type === "warning") ? i18n.translate("header-warning", { "defaultValue": "Warning" }) : "";

            formattedErrors.push(error);

            var errorLog = {
                category: "error",
                code: errors[i].code,
                message: errors[i].message
            };
            Logger.track(errorLog, true);
        }

        if (!formattedErrors.length)
            return;

        // Default image.
        var imgClass = "img-unsupported"; // "icons/error_unsupported_file_type.png";

        AlertBox.displayErrors(container, imgClass, formattedErrors);
    };

    ErrorHandler.parseArguments = function (errorMsg, options) {
        if (!errorMsg)
            return;

        // Add arguments
        if (typeof (errorMsg) === "string") {
            options.defaultValue = errorMsg;
        }
        else {
            // If there is an array, then there are arguments in the string.
            // Add them to the options (arguments are named: 0, 1, 2, ...
            options.defaultValue = errorMsg[0];
            for (var i = 1; i < errorMsg.length; i++) {
                var arg = i - 1;
                var argName = arg.toString();
                options[argName] = errorMsg[i];
            }
        }
    };

    ErrorHandler.parseErrorString = function (errorCode, options) {
        var error = {
            "msg": null,
            "msgList": null,
            "header": null,
            "hints": null
        };

        if (!errorCode)
            return error;

        // Translate the message.
        var msg = i18n.translate(errorCode, options);
        if (!msg)
            return error;

        // Split into header, message and hints. The messages may have the following format
        //   <title>header</title>text of the error message. <hint> hint-1 <hint> hint-2 ... <hint> hint-n
        //

        // Get the header
        if (msg.indexOf("<title>") != -1) {
            var parts = msg.split("<title>")[1].split("</title>");
            error.header = parts[0];
            msg = parts[1];
        }

        // Extract the message last.
        if (msg && msg.indexOf("<message>") != -1) {
            var parts = msg.split("<message>")[1].split("</message>");
            error.msg = parts[0];
            msg = parts[1];
        }
        else {
            error.msg = msg;
        }

        // Extract the hints next.
        if (msg && msg.indexOf("<hint>") != -1) {
            // There are hints.
            error.hints = [];
            var hints = msg.split("<hint>");
            for (var h = 0; h < hints.length; h++) {
                var hint = hints[h].split("</hint")[0];
                error.hints.push(hint);
            }
        }

        return error;
    };

    ErrorHandler.localize = function () {
        if (AlertBox.instances.length > 0) {
            AlertBox.dismiss();

            if (ErrorHandler.currentError) {
                var container = ErrorHandler.currentError.shift();
                var error = ErrorHandler.currentError;
                ErrorHandler.reportError(container, error[0], error[1], error[2]);
            } else {
                var container = ErrorHandler.currentErrors.shift();
                var errors = ErrorHandler.currentErrors[0];
                ErrorHandler.reportErrors(container, errors);
            }
        }
    };

    return ErrorHandler;
});