define([
    './Control', 
    '../../Core/Constants/DeviceType', 
    '../../Core/Utils/touchStartToClick'
], function(
    Control, 
    DeviceType,
    touchStartToClick
) {;
    'use strict'
    /**
     * @class
     * A button control that can be added to toolbars.
     *
     * @param {String?} id - The id for this button. Optional.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {Boolean} [options.collapsible=true] - Whether this button is collapsible.
     *
     * @constructor
     * @augments Autodesk.Viewing.UI.Control
     * @memberof Autodesk.Viewing.UI
     */
    function Button(id, options) {
        Control.call(this, id, options);

        var self = this;

        this._state = Button.State.INACTIVE;

        this.icon = document.createElement("div");
        this.icon.classList.add("adsk-button-icon");
        this.container.appendChild(this.icon);

        this.container.addEventListener('click', function (event) {
            if (self.getState() !== Button.State.DISABLED) {
                self.fireEvent(Button.Event.CLICK);
                if (self.onClick)
                    self.onClick(event);
            }
            event.stopPropagation();
        });

        // Add rollover only if this is not a touch device.
        if (!DeviceType.isTouchDevice) {
            this.container.addEventListener("mouseover", function (e) {
                self.onMouseOver(e);
            });

            this.container.addEventListener("mouseout", function (e) {
                self.onMouseOut(e);
            });
        } else {
            this.container.addEventListener("touchstart", touchStartToClick);
        }

        this.addClass('adsk-button');
        this.addClass(Button.StateToClassMap[this._state]);
    };

    /**
     * Enum for button event IDs.
     * @readonly
     * @enum {String}
     */
    Button.Event = {
        // Inherited from Control
        VISIBILITY_CHANGED: Control.Event.VISIBILITY_CHANGED,
        COLLAPSED_CHANGED: Control.Event.COLLAPSED_CHANGED,

        STATE_CHANGED: 'Button.StateChanged',
        CLICK: 'click'
    };

    /**
     * Enum for button states
     * @readonly
     * @enum {Number}
     */
    Button.State = {
        ACTIVE: 0,
        INACTIVE: 1,
        DISABLED: 2
    };

    /**
     * @private
     */
    Button.StateToClassMap = (function () {
        var state = Button.State;
        var map = {};

        map[state.ACTIVE] = 'active';
        map[state.INACTIVE] = 'inactive';
        map[state.DISABLED] = 'disabled';

        return map;
    }());


    /**
     * Event fired when state of the button changes.
     *
     * @event Autodesk.Viewing.UI.Button#STATE_CHANGED
     * @type {Object}
     * @property {String} buttonId - The ID of the button that fired this event.
     * @property {Autodesk.Viewing.UI.Button.State} state - The new state of the button.
     */

    Button.prototype = Object.create(Control.prototype);
    Button.prototype.constructor = Button;

    /**
     * Sets the state of this button.
     *
     * @param {Autodesk.Viewing.UI.Button.State} state - The state.
     *
     * @returns {Boolean} - True if the state was set successfully.
     *
     * @fires Autodesk.Viewing.UI.Button#STATE_CHANGED
     */
    Button.prototype.setState = function (state) {
        if (state === this._state) {
            return false;
        }

        this.removeClass(Button.StateToClassMap[this._state]);
        this.addClass(Button.StateToClassMap[state]);
        this._state = state;

        var event = {
            type: Button.Event.STATE_CHANGED,
            state: state
        };

        this.fireEvent(event);

        return true;
    };

    /**
     * Sets the icon for the button.
     *
     * @param {string} iconClass The CSS class defining the appearance of the button icon (e.g. image background).
     */
    Button.prototype.setIcon = function (iconClass) {
        if (this.iconClass)
            this.icon.classList.remove(this.iconClass);
        this.iconClass = iconClass;
        this.icon.classList.add(iconClass);
    };


    /**
     * Returns the state of this button.
     *
     * @returns {Autodesk.Viewing.UI.Button.State} - The state of the button.
     */
    Button.prototype.getState = function () {
        return this._state;
    };

    /**
     * Override this method to be notified when the user clicks on the button.
     * @param {MouseEvent} event
     */
    Button.prototype.onClick = function (event) {

    };

    /**
     * Override this method to be notified when the mouse enters the button.
     * @param {MouseEvent} event
     */
    Button.prototype.onMouseOver = function (event) {

    };

    /**
     * Override this method to be notified when the mouse leaves the button.
     * @param {MouseEvent} event
     */
    Button.prototype.onMouseOut = function (event) {

    };

    return Button;
});