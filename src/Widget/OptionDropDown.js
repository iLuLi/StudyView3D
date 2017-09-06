define([
    '../Core/EventDispatcher',
    '../i18n'
], function(EventDispatcher, i18n) {
    'use strict';
    var OptionDropDown = function (caption, parentTbody, items, initialItemIndex, options) {
        
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
        this.dropdownElement = document.createElement("select");
        this.dropdownElement.id = caption + "_dropdown";
        this.dropdownElement.className = "optionDropDown";

        for (var i = 0; i < items.length; i++) {
            var item = document.createElement("option");
            item.value = i;
            item.setAttribute("data-i18n", items[i]);
            item.textContent = i18n.translate(items[i]);
            this.dropdownElement.add(item);
        }

        this.selectedIndex = this.dropdownElement.selectedIndex = initialItemIndex;

        cell.appendChild(this.dropdownElement);
        cell.style.paddingLeft = "5px";
        cell.style.paddingRight = "5px";

        this.blockEvent = false;

        this.dropdownElement.addEventListener("change",
            function (e) {
                self.fireChangeEvent();
            }, false);

    };

    OptionDropDown.prototype.constructor = OptionDropDown;
    EventDispatcher.prototype.apply(OptionDropDown.prototype);


    OptionDropDown.prototype.setSelectedIndex = function (index) {
        this.blockEvent = true;
        this.selectedIndex = this.dropdownElement.selectedIndex = index;
        this.blockEvent = false;
    };

    OptionDropDown.prototype.setSelectedValue = function (value) {
        this.blockEvent = true;
        this.dropdownElement.selectedValue = value;
        this.selectedIndex = this.dropdownElement.selectedIndex;
        this.blockEvent = false;
    };

    OptionDropDown.prototype.fireChangeEvent = function () {
        if (!this.blockEvent) {
            this.selectedIndex = this.dropdownElement.selectedIndex;
            var e = new CustomEvent("change", {
                detail: {
                    target: this,
                    value: this.selectedIndex
                }
            });
            this.dispatchEvent(e);
        }
    };

    OptionDropDown.prototype.setDisabled = function (v) {
        this.dropdownElement.disabled = v;
        this.caption.disabled = v;
    };
    return OptionDropDown;
});