define([
    '../../Core/i18n'
], function(i18n) {
    'use strict';
    var AlertBox = function () {
    };

    AlertBox.instances = [];

    // static
    AlertBox.displayError = function (container, msg, title, imgClass, hints) {

        var alertBox = document.createElement("div");
        alertBox.className = "alertBox error";
        container.appendChild(alertBox);

        // Create the image element.
        var errorImageClass = imgClass;
        if (!errorImageClass)
            errorImageClass = "img-item-not-found";

        var alertBoxImg = document.createElement("div");
        alertBoxImg.className = "alertBoxImage " + errorImageClass;
        alertBox.appendChild(alertBoxImg);

        // Create the title & message element.
        var alertBoxMsg = document.createElement("div");
        alertBoxMsg.className = "alertBoxMsg";
        alertBox.appendChild(alertBoxMsg);

        var errorTitle = title;
        if (!errorTitle)
            errorTitle = i18n.translate("Error Occurred", { "defaultValue": "Error Occurred" });

        var alertBoxTitle = document.createElement("div");
        alertBoxTitle.className = "alertBoxTitle";
        alertBoxTitle.textContent = errorTitle;
        alertBoxMsg.appendChild(alertBoxTitle);

        var alertBoxText = document.createElement("div");
        alertBoxText.className = "alertBoxText";
        alertBoxText.textContent = msg;
        alertBoxMsg.appendChild(alertBoxText);

        // Add additional content
        if (hints) {
            var content = document.createElement("div");
            content.className = "alertBoxContent";
            alertBoxMsg.appendChild(content);

            var hintsElement = document.createElement("ul");
            hintsElement.className = "alertBoxContent";
            for (var h = 0; h < hints.length; h++) {
                var hint = hints[h];
                if (!hint)
                    continue;

                var hintElem = document.createElement("li");
                hintsElement.appendChild(hintElem);

                var result = this.extractList(hint);
                if (result.list.length) {
                    var unorderedlist = this.generateListElement(list);
                    hintsElement.appendChild(unorderedlist);
                }
                hintElem.innerHTML = result.msg;
            }
            content.appendChild(hintsElement);
        }

        var alertBoxOK = document.createElement("div");
        alertBoxOK.className = "alertBoxOK";
        alertBoxOK.textContent = i18n.translate("OK", { "defaultValue": "OK" });

        var instance = { alertBox: alertBox, container: container };
        alertBoxOK.addEventListener("click", function (event) {
            alertBox.style.visibility = "hidden";
            container.removeChild(alertBox);
            AlertBox.instances.splice(AlertBox.instances.indexOf(instance), 1);
        });
        alertBox.appendChild(alertBoxOK);

        alertBox.style.visibility = "visible";

        AlertBox.instances.push(instance);
    };

    // static
    AlertBox.displayErrors = function (container, imgClass, errors) {

        var alertBox = document.createElement("div");
        alertBox.className = "alertBox errors";
        container.appendChild(alertBox);

        // Create the image element.
        var errorImageClass = imgClass;
        if (!errorImageClass)
            errorImageClass = "img-item-not-found";

        var alertBoxImg = document.createElement("div");
        alertBoxImg.className = "alertBoxImage " + errorImageClass;
        alertBox.appendChild(alertBoxImg);

        // Create the title & message element.
        var alertBoxMsg = document.createElement("div");
        alertBoxMsg.className = "alertBoxMsg errors";
        alertBox.appendChild(alertBoxMsg);

        for (var i = 0; i < errors.length; i++) {

            var errorTitle = errors[i].header;
            if (!errorTitle)
                errorTitle = Autodesk.Viewing.i18n.translate("Error", { "defaultValue": "Error" });

            var alertBoxTitle = document.createElement("div");
            alertBoxTitle.className = "alertBoxTitle errors";
            alertBoxTitle.textContent = errorTitle;
            alertBoxMsg.appendChild(alertBoxTitle);

            // Add message, there maybe a list of files at the end.
            var alertBoxText = document.createElement("div");
            alertBoxText.className = "alertBoxText errors";

            var msg = errors[i].msg;
            var result = this.extractList(msg);
            if (result.list.length) {
                var listElem = document.createElement("div");
                var unorderedlist = this.generateListElement(result.list);
                listElem.appendChild(unorderedlist);

                alertBoxText.textContent = result.msg;
                alertBoxText.appendChild(listElem);
            } else {
                alertBoxText.textContent = msg;
            }
            alertBoxMsg.appendChild(alertBoxText);

            // Add additional content
            if (errors[i].hints) {
                var hintsElement = document.createElement("ul");
                hintsElement.className = "alertBoxContent";
                var hints = errors[i].hints;
                for (var h = 0; h < hints.length; h++) {
                    var hint = hints[h];
                    if (!hint)
                        continue;

                    var hintElem = document.createElement("li");
                    hintsElement.appendChild(hintElem);

                    var result = this.extractList(hint);
                    if (result.list.length) {
                        var unorderedlist = this.generateListElement(result.list);
                        hintsElement.appendChild(unorderedlist);
                    }
                    hintElem.innerHTML = result.msg;
                }
                alertBoxMsg.appendChild(hintsElement);
            }
        }

        var alertBoxOK = document.createElement("div");
        alertBoxOK.className = "alertBoxOK";
        alertBoxOK.textContent = i18n.translate("OK", { "defaultValue": "OK" });

        var instance = { alertBox: alertBox, container: container };
        alertBoxOK.addEventListener("click", function (event) {
            alertBox.style.visibility = "hidden";
            container.removeChild(alertBox);
            AlertBox.instances.splice(AlertBox.instances.indexOf(instance), 1);
        });
        alertBox.appendChild(alertBoxOK);

        alertBox.style.visibility = "visible";

        AlertBox.instances.push(instance);
    };

    AlertBox.extractList = function (msg) {
        var result = {
            "msg": msg,
            "list": []
        };

        if (msg && msg.indexOf("<ul>") != -1) {
            var parts = msg.split("<ul>");
            result.msg = parts[0];

            parts = parts[1].split("</ul>");
            result.list = parts[0].split(", ");
            if (result.list.length === 1) {
                // There maybe no spaces. Try just comma.
                result.list = parts[0].split(",");
            }
        }
        return result;
    };


    AlertBox.generateListElement = function (list) {
        var unorderedlist = document.createElement("ul");
        for (var l = 0; l < list.length; l++) {
            var listElement = document.createElement("li");
            listElement.textContent = list[l];
            unorderedlist.appendChild(listElement);
        }

        return unorderedlist;
    };


    // static
    AlertBox.dismiss = function () {
        // dismiss the topmost alert box
        if (AlertBox.instances.length > 0) {
            var instance = AlertBox.instances.pop();
            instance.alertBox.style.visibility = "hidden";
            instance.container.removeChild(instance.alertBox);
            return true;
        }
        return false;
    };


    return AlertBox;
});