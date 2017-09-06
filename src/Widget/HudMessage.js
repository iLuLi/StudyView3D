define([
    '../i18n'
], function(i18n) {
    'use strict';
    /** @constructor */
    var HudMessage = function () {
    };

    HudMessage.instances = [];

    // static
    HudMessage.displayMessage = function (container, messageSpecs, closeCB, buttonCB, checkboxCB) {

        // If hud message is already up, return.
        if (HudMessage.instances.length > 0)
            return;

        var msgTitle = messageSpecs.msgTitleKey;
        var msgTitleDefault = messageSpecs.msgTitleDefaultValue || msgTitle;
        var message = messageSpecs.messageKey;
        var messageDefault = messageSpecs.messageDefaultValue || message;
        var buttonText = messageSpecs.buttonText;
        var checkboxChecked = messageSpecs.checkboxChecked || false;

        var hudMessage = document.createElement("div");
        hudMessage.className = "hud";
        container.appendChild(hudMessage);

        var title = document.createElement("div");
        title.className = "hudTitle";
        title.textContent = i18n.translate(msgTitle, { "defaultValue": msgTitleDefault });
        title.setAttribute("data-i18n", msgTitle);
        hudMessage.appendChild(title);

        if (closeCB) {
            var closeButton = document.createElement("div");
            closeButton.className = "hudClose";
            closeButton.innerHTML = "&times;";
            closeButton.addEventListener('click', function (e) {
                HudMessage.dismiss();
                if (closeCB)
                    closeCB(e);
            });
            hudMessage.appendChild(closeButton);
        }

        var text = document.createElement("div");
        text.className = "hudMessage";
        text.textContent = i18n.translate(message, { "defaultValue": messageDefault });
        text.setAttribute("data-i18n", messageDefault);
        hudMessage.appendChild(text);

        if (buttonCB) {
            var button = document.createElement("div");
            button.className = "hudButton";
            button.textContent = i18n.translate(buttonText, { "defaultValue": buttonText });
            button.setAttribute("data-i18n", buttonText);
            button.addEventListener("click", buttonCB);
            hudMessage.appendChild(button);
        }

        if (checkboxCB) {
            var checkbox = document.createElement("div");
            var cb = document.createElement("input");
            cb.className = "hudCheckbox";
            cb.type = "checkbox";
            cb.checked = checkboxChecked;
            checkbox.appendChild(cb);

            var checkboxText = "Do not show this message again";    // localized below

            var lbl = document.createElement("label");
            lbl.setAttribute('for', checkboxText);
            lbl.setAttribute("data-i18n", checkboxText);
            lbl.textContent = i18n.translate(checkboxText, { "defaultValue": checkboxText });
            checkbox.appendChild(lbl);
            cb.addEventListener("change", checkboxCB);

            hudMessage.appendChild(checkbox);
        }

        var instance = { hudMessage: hudMessage, container: container };
        HudMessage.instances.push(instance);
    };

    HudMessage.dismiss = function () {
        // dismiss the topmost alert box
        if (HudMessage.instances.length > 0) {
            var instance = HudMessage.instances.pop();
            instance.hudMessage.style.visibility = "hidden";
            instance.container.removeChild(instance.hudMessage);
            return true;
        }
        return false;
    };

    return HudMessage;
});