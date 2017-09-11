define([
    '../../Core/Utils/setUserName'
], function(setUserName) {
    'use strict';
    var CollabPromptBox = function () { };
    CollabPromptBox.prototype.start = function (container, cb, titleText, buttonText, isInviteWindow) {
        if (!container) return;

        // Prevent multiple instantiations of invite boxes by spamming the 'Invite' button in collab panel.
        if (document.getElementById("collabBox")) {
            return;
        }

        var box = document.createElement("div");
        // If you change this id, make sure this.collabButton.onClick also updated to reflect new id.
        box.id = "collabBox";
        box.className = "collabBox";
        container.appendChild(box);

        var title = document.createElement("div");
        title.className = "collabBoxTitle";
        title.textContent = Autodesk.Viewing.i18n.translate(
            titleText,
            { "defaultValue": titleText });
        box.appendChild(title);

        var text = document.createElement("span");
        text.className = "collabBoxText";
        var label = "Enter your name";
        if (isInviteWindow) {
            label = "Review URL";
        }
        text.textContent = Autodesk.Viewing.i18n.translate(
            label,
            { "defaultValue": label });
        box.appendChild(text);

        var inputContainer = document.createElement("span");
        inputContainer.className = "collabBoxInputContainer";
        box.appendChild(inputContainer);
        var input = document.createElement("input");
        input.type = "text";
        input.className = "collabBoxInputText";
        if (isInviteWindow) {
            var url = window.location.toString();
            if (url.indexOf("?") == -1) {
                url += "?invited=true";
            } else {
                url += "&invited=true";
            }
            if (Autodesk.Viewing.Private.docItemId) {
                url += "&itemid=" + Autodesk.Viewing.Private.docItemId;
            }

            //Prevent Helios forwarding to Mobile app when the link is for RTC session (no RTC on Mobile)
            url += "&doNotRedirect=true";

            input.value = url;
        }
        inputContainer.appendChild(input);

        input.onkeyup = function (e) {
            if (e.keyCode == 13) {
                box.style.visibility = "hidden";
                container.removeChild(box);
                setUserName(input.value);
                cb();
            }
        };

        var close = document.createElement("div");
        close.className = "collabBoxClose";
        close.innerHTML = "&times;";
        close.addEventListener("click", function (event) {
            box.style.visibility = "hidden";
            container.removeChild(box);
        });
        box.appendChild(close);

        if (isInviteWindow) {
            /*
            var copy = document.createElement("div");
            copy.className = "collabBoxCopy";
            copy.textContent = Autodesk.Viewing.i18n.translate( "Copy", { "defaultValue" : "Copy" } );
            copy.addEventListener("click", function(event) {

            });
            box.appendChild(copy);
            */
            var text = document.createElement("span");
            text.className = "collabBoxText";
            text.style.marginTop = "0px";
            var label = "Copy and send this URL to invite others";

            text.textContent = Autodesk.Viewing.i18n.translate(
                label,
                { "defaultValue": label });
            box.appendChild(text);
        } else {
            var ok = document.createElement("div");
            ok.className = "collabBoxOK";
            ok.textContent = Autodesk.Viewing.i18n.translate(buttonText, { "defaultValue": buttonText });

            ok.addEventListener("click", function (event) {
                box.style.visibility = "hidden";
                container.removeChild(box);
                if (input.value.trim() !== "") {
                    setUserName(input.value);
                }
                cb();
            });
            box.appendChild(ok);
        }
        box.style.visibility = "visible";

        input.focus();
        if (isInviteWindow)
            input.select();
    };

    return CollabPromptBox;
});