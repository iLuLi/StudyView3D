define([
    './Control'
], function(Control) {
    'use strict';
    /**
     * @class
     * A class for grouping controls.
     *
     * @param {String} id - The id for this control group.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {Boolean} [options.collapsible=true] - Whether this control group is collapsible
     *
     * @constructor
     * @augments Autodesk.Viewing.UI.Control
     * @memberof Autodesk.Viewing.UI
     */

    function ControlGroup(id, options) {
        Control.call(this, id, options);

        var self = this;

        this._controls = [];

        this.addClass('adsk-control-group');

        this.handleChildSizeChanged = function (event) {
            var sizeEvent = {
                type: ControlGroup.Event.SIZE_CHANGED,
                childEvent: event
            };
            self.fireEvent(sizeEvent);
        };
    };

    /**
     * Enum for control group event IDs.
     * @readonly
     * @enum {String}
     */
    ControlGroup.Event = {
        // Inherited from Control
        VISIBILITY_CHANGED: Control.Event.VISIBILITY_CHANGED,
        COLLAPSED_CHANGED: Control.Event.COLLAPSED_CHANGED,

        SIZE_CHANGED: 'ControlGroup.SizeChanged',
        CONTROL_ADDED: 'ControlGroup.ControlAdded',
        CONTROL_REMOVED: 'ControlGroup.ControlRemoved'
    };

    /**
     * Event fired a control is added to the control group.
     *
     * @event Autodesk.Viewing.UI.ControlGroup#CONTROL_ADDED
     * @type {Object}
     * @property {String} control - The control that was added.
     * @property {Number} index - The index at which the control was added.
     */

    /**
     * Event fired when a control is removed from the control group.
     *
     * @event Autodesk.Viewing.UI.ControlGroup#CONTROL_REMOVED
     * @type {Object}
     * @property {String} control - The control that was removed.
     * @property {Number} index - The index at which the control was removed.
     */

    /**
     * Event fired when the size of the control group changes.
     *
     * @event Autodesk.Viewing.UI.ControlGroup#SIZE_CHANGED
     * @type {Object}
     * @property {Object?} childEvent - The event that the child fired.
     */

    ControlGroup.prototype = Object.create(Control.prototype);
    ControlGroup.prototype.constructor = ControlGroup;

    /**
     * Adds a control to this control group.
     *
     * @param {Autodesk.Viewing.UI.Control} control - The control to add.
     * @param {Object} [options] - An option dictionary of options.
     * @param {Object} [options.index] - The index to insert the control at.
     *
     * @returns {Boolean} - True if the control was successfully added.
     *
     * @fires Autodesk.Viewing.UI.ControlGroup#CONTROL_ADDED
     * @fires Autodesk.Viewing.UI.ControlGroup#SIZE_CHANGED
     */
    ControlGroup.prototype.addControl = function (control, options) {

        var index = (options && options.index !== undefined) ? options.index : this._controls.length;

        if (this.getControl(control.getId()) !== null) {
            return false;
        }

        var addedEvent = {
            type: ControlGroup.Event.CONTROL_ADDED,
            control: control,
            index: index
        };

        if (index < this._controls.length) {
            this.container.insertBefore(control.container, this._controls[index].container);
            this._controls.splice(index, 0, control);
        } else {
            this.container.appendChild(control.container);
            this._controls.push(control);
        }

        // Listen for events on the child controls that may trigger a change in out size
        control.addEventListener(Control.Event.VISIBILITY_CHANGED, this.handleChildSizeChanged);
        control.addEventListener(Control.Event.COLLAPSED_CHANGED, this.handleChildSizeChanged);
        if (control instanceof ControlGroup) {
            control.addEventListener(ControlGroup.Event.SIZE_CHANGED, this.handleChildSizeChanged);
        }

        this.fireEvent(addedEvent);
        this.fireEvent(ControlGroup.Event.SIZE_CHANGED);

        return true;
    };

    /**
     * Returns the index of a control in this group. -1 if the item isn't found.
     *
     * @param {String|Autodesk.Viewing.UI.Control} control - The control ID or control instance to find
     *
     * @returns {Number} - True if the control was successfully removed.
     */
    ControlGroup.prototype.indexOf = function (control) {
        for (var i = 0; i < this._controls.length; i++) {
            var c = this._controls[i];
            if (c === control || (typeof control === "string" && control === c.getId())) {
                return i;
            }
        }

        return -1;
    };

    /**
     * Removes a control from this control group.
     *
     * @param {String|Autodesk.Viewing.UI.Control} control - The control ID or control instance to remove
     *
     * @returns {Boolean} - True if the control was successfully removed.
     *
     * @fires Autodesk.Viewing.UI.ControlGroup#CONTROL_REMOVED
     * @fires Autodesk.Viewing.UI.ControlGroup#SIZE_CHANGED
     * 
     */
    ControlGroup.prototype.removeControl = function (control) {

        var thecontrol = (typeof control === "string") ? this.getControl(control) : control;

        if (!thecontrol) {
            return false;
        }

        var index = this._controls.indexOf(thecontrol);
        this._controls.splice(index, 1);
        this.container.removeChild(thecontrol.container);

        var addedEvent = {
            type: ControlGroup.Event.CONTROL_REMOVED,
            control: thecontrol,
            index: index
        };

        // Remove listeners from children
        thecontrol.removeEventListener(Control.Event.VISIBILITY_CHANGED, this.handleChildSizeChanged);
        thecontrol.removeEventListener(Control.Event.COLLAPSED_CHANGED, this.handleChildSizeChanged);
        if (thecontrol instanceof ControlGroup) {
            thecontrol.removeEventListener(ControlGroup.Event.SIZE_CHANGED, this.handleChildSizeChanged);
        }

        this.fireEvent(addedEvent);
        this.fireEvent(ControlGroup.Event.SIZE_CHANGED);

        return true;
    };

    /**
     * Returns the control with the corresponding ID if it is in this control group.
     *
     * @param {String} controlId - The ID of the control.
     *
     * @returns {Autodesk.Viewing.UI.Control?} - The control or Null if it doesn't exist.
     */
    ControlGroup.prototype.getControl = function (controlId) {
        for (var i = 0; i < this._controls.length; i++) {
            if (controlId === this._controls[i].getId()) {
                return this._controls[i];
            }
        }

        return null;
    };

    /**
     * Returns the number of controls in this control group.
     *
     * @returns {Number} - The number of controls.
     */
    ControlGroup.prototype.getNumberOfControls = function () {
        return this._controls.length;
    };

    /**
     * Sets the collapsed state of this control group. Iterates over the child controls and calls child.setCollapsed(collapsed).
     *
     * @param {Boolean} collapsed - The collapsed value to set.
     *
     * @returns {Boolean} - True if at least one collapsible child's state changes
     *
     * @fires Autodesk.Viewing.UI.Control#COLLAPSED_CHANGED
     */
    ControlGroup.prototype.setCollapsed = function (collapsed) {
        if (!this._isCollapsible) {
            return false;
        }

        var childHasCollapsed = false;

        this._controls.forEach(function (control) {
            if (control.isCollapsible() && control.setCollapsed(collapsed)) {
                childHasCollapsed = true;
            }
        });

        if (childHasCollapsed) {
            if (collapsed) {
                this.container.classList.add('collapsed');
            } else {
                this.container.classList.remove('collapsed');
            }

            this.fireEvent({
                type: ControlGroup.Event.COLLAPSED_CHANGED,
                isCollapsed: collapsed
            });
        }

        return childHasCollapsed;
    };

    return ControlGroup;

});