define([
    './DockingPanel',
    '../Core/Fn/touchStartToClick',
    '../i18n',
    './OptionCheckbox'
], function(DockingPanel, touchStartToClick, i18n, OptionCheckbox) {
    'use strict';
    /**
     *  SettingsPanel represents a panel specifically designed for application
     *  settings.
     *
     *  @class
     *  @augments DockingPanel
     *
     *  The user can add new options to each of the tabs.
     *
     *  @param {HTMLElement} parentContainer - The container for this panel.
     *  @param {string} id - The id to assign this panel.
     *  @param {string} title - The title of this panel.
     *  @param {Object=} [options] - An optional dictionary of options.
     *
     * @constructor
     */
    var SettingsPanel = function (parentContainer, id, title, options) {
    
    
        DockingPanel.call(this, parentContainer, id, title, options);
    
        this.panelTabs = [];
        this.tabIdToIndex = {};
        this.controls = {};
        this.controlIdCount = 0;    // to generate unique ids for controls.
    
        var settings = this;
    
        var minWidth = options && options.width !== undefined ? options.width : 340;
    
        this.container.style.maxWidth = "800px";
        this.container.style.minWidth = minWidth + "px";
        this.container.style.top = "100px";
        this.container.style.left = (parentContainer.offsetWidth / 2 - 170) + "px"; //center it horizontally
        //this.container.style.left     = "220px"; // just needs an initial value dock overrides value
        this.container.style.position = "absolute";
        //this.container.dockRight = true;
    
        this.tabContainer = document.createElement("div");
        this.tabContainer.className = "settings-tabs";
        this.container.appendChild(this.tabContainer);
    
        this.tabs = document.createElement("ul");
        this.tabContainer.appendChild(this.tabs);
    
        this.heightAdjustment = options && options.heightAdjustment ? options.heightAdjustment : 110;
        this.createScrollContainer({ left: false, heightAdjustment: this.heightAdjustment, marginTop: 0 });
    
        // Add hovering effect.
        //
        this.mouseOver = false;
        this.addEventListener(this.container, "mouseover", function (event) {
            // This is the original element the event handler was assigned to
            var e = event.toElement || event.relatedTarget;
            if (settings.mouseOver)
                return true;
    
            // Check for all children levels (checking from bottom up)
            var index = 0;
            while (e && e.parentNode && e.parentNode != window) {
                if (e.parentNode == this || e == this) {
                    if (e.preventDefault) e.preventDefault();
                    settings.mouseOver = true;
    
                    for (var index = 0; index < settings.panelTabs.length; index++)
                        settings.panelTabs[index].classList.remove("selectedmouseout");
                    return true;
                }
                e = e.parentNode;
            }
        });
    
        this.addEventListener(this.container, "mouseout", function (event) {
            // This is the original element the event handler was assigned to
            var e = event.toElement || event.relatedTarget;
            if (!settings.mouseOver)
                return;
    
            // Check for all children levels (checking from bottom up)
            while (e && e.parentNode && e.parentNode != window) {
                if (e.parentNode == this || e == this) {
                    if (e.preventDefault) e.preventDefault();
                    return false;
                }
                e = e.parentNode;
            }
            settings.mouseOver = false;
    
            var selectedTab = null;
            for (var index = 0; index < settings.panelTabs.length; index++) {
                if (settings.panelTabs[index].classList.contains("tabselected"))
                    settings.panelTabs[index].classList.add("selectedmouseout");
            }
        });
    
        this.expandID = function (controlID) { return id + '-' + controlID; };
    };
    
    SettingsPanel.prototype = Object.create(DockingPanel.prototype);
    SettingsPanel.prototype.constructor = SettingsPanel;
    
    /**
     *  Sets the new visibility state of this SettingsPanel.
     *
     *  @param {boolean} show - The desired visibility state.
     *  @param {boolean} skipTransition - If true, skips initial opaque state and displays directly with final background color
     */
    SettingsPanel.prototype.setVisible = function (show) {
        if (show) {
            // Since the container does not have width and when display set to none
            // getBoundingClientRect() returns 0, set the display to block before the
            // parent calculates the position and the panel.
            // NOTE: Setting the width for the container does not work here.
            this.container.style.display = "block";
        }
    
        DockingPanel.prototype.setVisible.call(this, show);
    };
    
    /**
     * Adds a new tab to the panel.
     *
     * @param {string} tabId - id for the tab (DOM element will have an extended ID to ensure uniqueness)
     * @param {string} tabTitle
     * @param {Object=} [options] - optional parameter that allows for additional
     *   options for the tab:
     *          tabClassName - class name for the Dom elements
     *          minWidth - min width for the tab
     *          index - index if the tab should be inserted instead of added at the end.
     * @returns {boolean} - true if the tab was added to the panel, false otherwise.
     */
    SettingsPanel.prototype.addTab = function (tabId, tabTitle, options) {
        var settings = this;
    
        if (this.tabIdToIndex[tabId] !== undefined)
            return false;
    
        var tabDomClass = options && options.className !== undefined ? options.className : null;
        var minWidth = options && options.width !== undefined ? options.width : 200;
        var tabIndex = options && options.index !== undefined ? options.index : this.panelTabs.length;
    
        function select(e) {
            settings.selectTab(tabId);
        }
    
        var tab = document.createElement("li");
        tab._id = tabId; // local ID
        tab.id = this.expandID(tab._id); // DOM ID
    
        var title = document.createElement("a");
        var span = document.createElement("span");
        span.setAttribute("data-i18n", tabTitle);
        span.textContent = i18n.translate(tabTitle);
        title.appendChild(span);
        tab.appendChild(title);
    
        this.tabs.appendChild(tab);
    
        var table = document.createElement("table");
        table._id = tabId + "-table"; // local ID
        table.id = this.expandID(table._id); // DOM ID
        table.className = "settings-table adsk-lmv-tftable " + tabDomClass;
    
        var tbody = document.createElement("tbody");
        table.appendChild(tbody);
    
        this.scrollContainer.appendChild(table);
    
        this.addEventListener(tab, "touchstart", touchStartToClick);
        this.addEventListener(tab, "click", select);
    
        this.panelTabs.push(tab);
        this.tabIdToIndex[tabId] = tabIndex;
    
        // Adjust the panel's minWidth.
        var currentMinWidth = this.container.style.minWidth ? parseInt(this.container.style.minWidth) : 0;
        if (minWidth > currentMinWidth)
            this.container.style.minWidth = minWidth + "px";
    
        return true;
    };
    
    /**
     * Removes the given tab from the panel.
     *
     * @param {string} tabId - tab to remove.
     * @return {boolean} - returns true if the tab was successfully removed, false otherwise.
     */
    SettingsPanel.prototype.removeTab = function (tabId) {
    
        var tabIndex = this.tabIdToIndex[tabId];
        if (!tabIndex)
            return false;
    
        this.panelTabs.splice(tabIndex, 1);
    
        this.tabs.removeChild(tabDom);
    
        // Adjust the idToIndex table and add space (right margin) to all tabs except the last one.
        this.tabIdToIndex = {};
        var tabCount = this.panelTabs.length;
        for (var index = 0; index < tabCount; index++) {
            var tab = this.panelTabs[index];
            this.tabIdToIndex[tab._id] = index;
        }
        return true;
    };
    
    /**
     * Returns true if a tab with given id exists.
     *
     * @param {string} tabId - tab id.
     * @returns {boolean} - true if the tab with given id exists, false otherwise.
     */
    SettingsPanel.prototype.hasTab = function (tabId) {
        var tabIndex = this.tabIdToIndex[tabId];
        var tab = this.panelTabs[tabIndex];
        return tab !== undefined;
    };
    
    /**
     * Makes a given tab visible and hides the other ones.
     *
     * @param {string} tabId - tab to select.
     * @returns {boolean} - true if the tab was selected, false otherwise.
     *
     */
    SettingsPanel.prototype.selectTab = function (tabId) {
        if (this.isTabSelected(tabId))
            return false;
    
        var tabCount = this.panelTabs.length;
        for (var tabIndex = 0; tabIndex < tabCount; tabIndex++) {
            var tab = this.panelTabs[tabIndex];
            var table = document.getElementById(this.expandID(tab._id + "-table"));
            if (tabId === tab._id) {
                tab.classList.add("tabselected");
                table.style.display = 'table';
                if (!this.mouseOver) {
                    tab.classList.add("selectedmouseout");
                }
            }
            else {
                tab.classList.remove("tabselected");
                table.style.display = 'none';
                if (!this.mouseOver) {
                    this.panelTabs[tabIndex].classList.remove("selectedmouseout");
                }
            }
        }
    
        this.resizeToContent();
    
        return true;
    };
    
    /**
     * Returns true if the given tab is selected (visible).
     *
     * @param {string} tabId - tab to check.
     * @returns {boolean} - returns true if the tab is selected, false otherwise.
     *
     */
    SettingsPanel.prototype.isTabSelected = function (tabId) {
        var tabIndex = this.tabIdToIndex[tabId];
        var tab = this.panelTabs[tabIndex];
        return tab && tab.classList.contains('tabselected');
    };
    
    /**
     * Creates a checkbox control and adds it to a given tab.
     *
     * @param {string} tabId - tab to which to add a new checkbox.
     * @param {string} caption - the text associated with the checkbox
     * @param {boolean} initialState - initial value for the checkbox (checked or not)
     * @param {function} onchange - callback that is called when the checkbox is changed
     * @param {Object|undefined} options - additional options:
     *      insertAtIndex {number} - index at which to insert a new checkbox
     * @returns {string} - id of a new control.
     *
     */
    SettingsPanel.prototype.addCheckbox = function (tabId, caption, initialState, onchange, options) {
        var tabIndex = this.tabIdToIndex[tabId];
        if (tabIndex === undefined)
            return null;
    
        var table = document.getElementById(this.expandID(tabId + "-table"));
        var checkBoxElem = new OptionCheckbox(caption, table.tBodies[0], initialState, options);
        checkBoxElem.changeListener = function (e) {
            var checked = e.detail.target.checked;
            onchange(checked);
        };
        this.addEventListener(checkBoxElem, "change", checkBoxElem.changeListener);
    
        return this.addControl(tabId, checkBoxElem);
    };
    
    /**
     * Creates a slider control and adds it to a given tab.
     *
     * @param {string} tabId - tab to which to add a new slider.
     * @param {string} caption - the text associated with the slider
     * @param {number} min - min value of the slider
     * @param {number} max - max value of the slider
     * @param {number} initialValue - initial value for the slider
     * @param {function} onchange - callback that is called when the slider value is changed
     * @param {Object|undefined} options - additional options:
     *      insertAtIndex {number} - index at which to insert a new slider
     * @returns {string} - id of a new control.
     *
     */
    SettingsPanel.prototype.addSlider = function (tabId, caption, min, max, initialValue, onchange, options) {
        var tabIndex = this.tabIdToIndex[tabId];
        if (tabIndex === undefined)
            return null;
    
        var table = document.getElementById(this.expandID(tabId + "-table"));
    
        var slider = new Autodesk.Viewing.Private.OptionSlider(caption, min, max, table.tBodies[0], options);
        slider.setValue(initialValue);
        slider.sliderElement.step = slider.stepperElement.step = 1;
        this.addEventListener(slider, "change", function (e) {
            onchange(e);
        });
    
        return this.addControl(tabId, slider);
    };
    
    /**
     *
     * @param {string} tabId - tab to which to add a new slider.
     * @param {string} caption - the text associated with the slider
     * @param {array}  items - list of items for the menu
     * @param {number} initialItemIndex - initial choice
     * @param {function} onchange - callback that is called when the menu selection is changed
     * @param {Object|undefined} options - additional options:
     *      insertAtIndex {number} - index at which to insert a new drop down menu.
     * @returns {string} - id of a new control.
     */
    SettingsPanel.prototype.addDropDownMenu = function (tabId, caption, items, initialItemIndex, onchange, options) {
        var tabIndex = this.tabIdToIndex[tabId];
        if (tabIndex === undefined)
            return null;
    
        var table = document.getElementById(this.expandID(tabId + "-table"));
    
        var menu = new Autodesk.Viewing.Private.OptionDropDown(caption, table.tBodies[0], items, initialItemIndex, options);
        this.addEventListener(menu, "change", function (e) {
            onchange(e);
        });
    
        return this.addControl(tabId, menu);
    };
    
    /**
     * Adds a new control to a given tab.
     *
     * @param {string} tabId - tab to which to add a new.
     * @param {Object|HTMLElement} control - control to add to the given tab.
     * @param {Object|undefined} options - additional parameters:
     *      insertAtIndex {number}  - index at which to insert a new control.
     *      caption {string} - caption for the control.
     * @returns {string} - id of the added control.
     */
    SettingsPanel.prototype.addControl = function (tabId, control, options) {
        var tabIndex = this.tabIdToIndex[tabId];
        if (tabIndex === undefined)
            return null;
    
        // If this is a generic control (not created by one of the convenient methods
        // like addCheckbox, addSlider, etc. then add it to the table first.
        //
        if (!control.hasOwnProperty("sliderRow")) {
            var atIndex = options && options.insertAtIndex ? options.insertAtIndex : -1;
            var caption = options && options.caption ? options.caption : null;
    
            var table = document.getElementById(this.expandID(tabId + "-table"));
            if (atIndex > table.length)
                atIndex = -1; // add it to the end.
            var sliderRow = table.tBodies[0].insertRow(atIndex);
    
            var cell = sliderRow.insertCell(0);
            if (caption) {
                var domCaption = document.createElement("div");
                domCaption.setAttribute("data-i18n", caption);
                domCaption.textContent = i18n.translate(caption);
                cell.appendChild(domCaption);
                cell = sliderRow.insertCell(1);
            }
            else {
                // Span the cell into 2 columns
                cell.colSpan = 2;
            }
            cell.appendChild(control);
    
            control.sliderRow = sliderRow;
            control.tbody = table.tBodies[0];
        }
    
        var controlId = this.expandID("adsk_settings_control_id_" + this.controlIdCount.toString());
        this.controlIdCount = this.controlIdCount + 1;
        this.controls[controlId] = control;
    
        this.resizeToContent();
    
        return controlId;
    };
    
    /**
     * Removes a given checkbox from the settings panel.
     *
     * @param {string} checkboxId - checkbox to remove.
     * @returns {boolean} - true if the checkbox was removed, false otherwise.
     *
     */
    SettingsPanel.prototype.removeCheckbox = function (checkboxId) {
        return this.removeControl(checkboxId);
    };
    
    /**
     * Removes a given slider from the settings panel.
     *
     * @param {string} sliderId - slider control to remove.
     * @returns {boolean} - true if the slider control was removed, false otherwise.
     *
     */
    SettingsPanel.prototype.removeSlider = function (sliderId) {
        return this.removeControl(sliderId);
    };
    
    /**
     * Removes a given dropdown menu from the settings panel.
     *
     * @param {string} dropdownMenuId - checkbox to remove.
     * @returns {boolean} - true if the dropdown menu was removed, false otherwise.
     *
     */
    SettingsPanel.prototype.removeCheckbox = function (dropdownMenuId) {
        return this.removeControl(dropdownMenuId);
    };
    
    /**
     * Removes a given control from the settings panel.
     *
     * @param {string} controlId - control to remove.
     * @returns {boolean} - true if the  control was removed, false otherwise.
     *
     */
    SettingsPanel.prototype.removeControl = function (controlId) {
        var control;
        if (typeof controlId == "object" && controlId.tbody) {
            control = controlId;
        } else {
            control = this.controls[controlId];
        }
    
        if (control === undefined)
            return false;
    
        var tbody = control.tbody;
        var sliderRow = control.sliderRow;
        var rowIndex = sliderRow.rowIndex;
    
        tbody.deleteRow(rowIndex);
    
        delete this.controls[controlId];
    
        this.resizeToContent();
    
        return true;
    };
    
    /**
     * Returns a control with a given id.
     *
     * @param {string} controlId - checkbox id to return.
     * @returns {Object} - control object if if found, null otherwise.
     *
     */
    SettingsPanel.prototype.getControl = function (controlId) {
        return (this.controls[controlId] !== undefined) ? this.controls[controlId] : null;
    };
    
    /**
     * Returns the width and height to be used when resizing the panel to the content.
     *
     * @returns {{height: number, width: number}}
     */
    SettingsPanel.prototype.getContentSize = function () {
    
        var height = this.heightAdjustment;
    
        // If none of the tabs is selected, then take the fist one (case when
        // there is only one tab).
        var selectedTab = this.panelTabs.length > this.panelTabs[0] ? 0 : null;
        for (var tabIndex = 0; tabIndex < this.panelTabs.length; tabIndex++) {
            var tab = this.panelTabs[tabIndex];
            if (this.isTabSelected(tab._id)) {
                selectedTab = tab;
                break;
            }
        }
    
        if (selectedTab) {
            var table = document.getElementById(this.expandID(tab._id + "-table"));
            height = height + table.clientHeight;
        }
    
        return {
            height: height,
            width: this.container.clientWidth
        };
    };

    return SettingsPanel;
});