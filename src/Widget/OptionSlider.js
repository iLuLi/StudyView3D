define([
    '../Core/EventDispatcher',
    '../i18n'
], function(EventDispatcher, factory) {
    'use strict';
    /** @constructor */
    var OptionSlider = function (caption, min, max, parentTbody, options) {
        var self = this;
        this.tbody = parentTbody;

        var atIndex = options && options.insertAtIndex ? options.insertAtIndex : -1;
        this.sliderRow = this.tbody.insertRow(atIndex);

        var cell = this.sliderRow.insertCell(0);
        this.caption = document.createElement("div");
        this.caption.setAttribute("data-i18n", caption);
        this.caption.textContent = i18n.translate(caption);

        this.sliderElement = document.createElement("input");
        this.sliderElement.type = "range";
        this.sliderElement.id = caption + "_slider";
        this.sliderElement.min = min;
        this.sliderElement.max = max;
        //this.sliderElement.style.width = "95%";
        cell.appendChild(this.caption);
        cell.appendChild(this.sliderElement);

        cell = this.sliderRow.insertCell(1);
        this.stepperElement = document.createElement("input");
        this.stepperElement.type = "number";
        this.stepperElement.id = caption + "_stepper";
        this.stepperElement.min = min;
        this.stepperElement.max = max;
        this.stepperElement.step = 1;
        //this.stepperElement.style.resize = "none";
        this.stepperElement.style.width = "64px";
        cell.appendChild(this.stepperElement);

        this.blockEvent = false;

        this.stepperElement.addEventListener("change",
            function (e) {
                if (e.target != self.sliderElement)
                    self.sliderElement.value = self.stepperElement.value;
                self.fireChangeEvent();
            }, false);

        function changeHandler(e) {
            if (e.target != self.stepperElement)
                self.stepperElement.value = self.sliderElement.value;
            self.fireChangeEvent();
        }

        this.sliderElement.addEventListener("change", changeHandler, false);
        this.sliderElement.addEventListener("input", changeHandler, false);
    };

    OptionSlider.prototype.constructor = OptionSlider;
    EventDispatcher.prototype.apply(OptionSlider.prototype);

    OptionSlider.prototype.fireChangeEvent = function () {
        if (!this.blockEvent) {
            this.value = this.sliderElement.value;
            var e = new CustomEvent("change", {
                detail: {
                    target: this,
                    value: this.sliderElement.value
                }
            });
            this.dispatchEvent(e);
        }
    };

    OptionSlider.prototype.setValue = function (v) {
        this.blockEvent = true;
        this.value = v;
        this.sliderElement.value = v;
        this.stepperElement.value = v;
        this.blockEvent = false;
    };

    OptionSlider.prototype.setDisabled = function (v) {
        this.sliderElement.disabled = v;
        this.stepperElement.disabled = v;
        this.caption.disabled = v;
    };

    return OptionSlider;
});