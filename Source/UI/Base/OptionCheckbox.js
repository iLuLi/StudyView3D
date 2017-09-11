define([
    '../../Core/Constants/DeviceType',
    '../../Core/EventDispatcher',
    'Hammer',
    '../../Core/i18n'
], function(DeviceType, EventDispatcher, Hammer, i18n) {
    'use strict';
    /** @constructor */
    var OptionCheckbox = function (caption, parentTbody, initialState, options) {
        var self = this;
        this.tbody = parentTbody;

        var atIndex = options && options.insertAtIndex ? options.insertAtIndex : -1;
        this.sliderRow = this.tbody.insertRow(atIndex);

        var cell = this.sliderRow.insertCell(0);
        this.caption = document.createElement("div");
        this.caption.setAttribute("data-i18n", caption);
        this.caption.textContent = i18n.translate(caption);

        cell.appendChild(this.caption);

        cell = this.sliderRow.insertCell(1);
        this.checkElement = document.createElement("input");
        this.checkElement.type = "checkbox";
        this.checkElement.id = caption + "_check";
        this.checkElement.checked = initialState;
        cell.appendChild(this.checkElement);
        //cell.style.width = "26px";

        this.blockEvent = false;
        this.checked = initialState;

        this.checkElement.addEventListener("change",
            function (e) {
                self.fireChangeEvent();
            }, false);

        if (DeviceType.isTouchDevice) {
            // Tap on a checkbox is handled by the browser so we don't hav to do anything for it.

            this.sliderRowHammer = new Hammer.Manager(this.sliderRow, {
                recognizers: [[Hammer.Tap]],
                inputClass: Hammer.TouchInput
            });
            this.sliderRowHammer.on("tap", function (e) {
                e.preventDefault();
                //e.stopPropagation(); // Doesn't exist for tap events.
                e.target.click();
            });
        }

        this.checkElement.addEventListener("click", function (event) {
            event.stopPropagation();
        }, false);

        // Make the slider row clickable as well so that when
        // clicking on the row, the checkbox is toggled.
        this.sliderRow.addEventListener("click",
            function (e) {
                if (!self.checkElement.disabled) {
                    self.checkElement.checked = !self.checkElement.checked;
                    self.fireChangeEvent();
                }
            }, false);
    };

    OptionCheckbox.prototype.constructor = OptionCheckbox;
    EventDispatcher.prototype.apply(OptionCheckbox.prototype);

    OptionCheckbox.prototype.fireChangeEvent = function () {
        if (!this.blockEvent) {
            this.checked = this.checkElement.checked;
            var e = new CustomEvent("change", {
                detail: {
                    target: this,
                    value: this.checkElement.checked
                }
            });
            this.dispatchEvent(e);
        }
    };

    OptionCheckbox.prototype.setValue = function (v) {
        this.blockEvent = true;
        this.checked = v;
        this.checkElement.checked = v;
        this.blockEvent = false;
    };

    OptionCheckbox.prototype.setDisabled = function (v) {
        this.checkElement.disabled = v;
        this.caption.disabled = v;
    };

    OptionCheckbox.prototype.setVisibility = function (isVisible) {
        if (isVisible)
            this.sliderRow.style.display = "table-row";
        else
            this.sliderRow.style.display = "none";
    };

    return OptionCheckbox;
});