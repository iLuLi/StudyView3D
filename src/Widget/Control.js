define([
    '../Core/EventDispatcher',
    '../i18n'
], function(EventDispatcher, i18n) {
    'use strict';
    /**
     * @class
     * This is the base class for controls. It is abstract and should not be instantiated directly.
     *
     * @param {String} id - The id for this control. Optional.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {Boolean} [options.collapsible=true] - Whether this control is collapsible
     *
     * @constructor
     * @abstract
     * @memberof Autodesk.Viewing.UI
     */
    function Control(id, options) {
        this._id = id;
        this._isCollapsible = !options || options.collapsible;

        this._toolTipElement = null;

        this._listeners = {};

        this.container = document.createElement('div');
        this.container.id = id;
        this.addClass('adsk-control');
    };

    /**
     * Enum for control event IDs.
     * @readonly
     * @enum {String}
     */
    Control.Event = {
        VISIBILITY_CHANGED: 'Control.VisibilityChanged',
        COLLAPSED_CHANGED: 'Control.CollapsedChanged'
    };

    /**
     * Event fired when the visibility of the control changes.
     *
     * @event Autodesk.Viewing.UI.Control#VISIBILITY_CHANGED
     * @type {Object}
     * @property {String} controlId - The ID of the control that fired this event.
     * @property {Boolean} isVisible - True if the control is now visible.
     */

    /**
     * Event fired when the collapsed state of the control changes.
     *
     * @event Autodesk.Viewing.UI.Control#COLLAPSED_CHANGED
     * @type {Object}
     * @property {String} controlId - The ID of the control that fired this event.
     * @property {Boolean} isCollapsed - True if the control is now collapsed.
     */

    EventDispatcher.prototype.apply(Control.prototype);
    Control.prototype.constructor = Control;

    /**
     * The HTMLElement representing this control.
     *
     * @type {HTMLElement}
     * @public
     */
    Control.prototype.container = null;

    /**
     * Gets this control's ID.
     *
     * @returns {String} - The control's ID.
     */
    Control.prototype.getId = function () {
        return this._id;
    };

    /**
     * Sets the visibility of this control.
     *
     * @param {Boolean} visible - The visibility value to set.
     *
     * @returns {Boolean} - True if the control's visibility changed.
     *
     * @fires Autodesk.Viewing.UI.Control#VISIBILITY_CHANGED
     */
    Control.prototype.setVisible = function (visible) {
        var isVisible = !this.container.classList.contains('adsk-hidden');

        if (isVisible === visible) {
            return false;
        }

        if (visible) {
            this.container.classList.remove('adsk-hidden');
        } else {
            this.container.classList.add('adsk-hidden');
        }

        var event = {
            type: Control.Event.VISIBILITY_CHANGED,
            target: this,
            controlId: this._id,
            isVisible: visible
        };

        this.fireEvent(event);

        return true;
    };

    /**
     * Gets the visibility of this control.
     *
     * @returns {Boolean} - True if the this control is visible.
     */
    Control.prototype.isVisible = function () {
        return !this.container.classList.contains('adsk-hidden');
    };

    /**
     * Sets the tooltip text for this control.
     *
     * @param {String} toolTipText - The text for the tooltip.
     *
     * @returns {Boolean} - True if the tooltip was successfully set.
     */
    Control.prototype.setToolTip = function (toolTipText) {
        if (this._toolTipElement && this._toolTipElement.getAttribute("tooltipText") === toolTipText) {
            return false;
        }

        if (!this._toolTipElement) {
            this._toolTipElement = document.createElement('div');
            this._toolTipElement.id = this._id + '-tooltip';
            this._toolTipElement.classList.add('adsk-control-tooltip');
            this.container.appendChild(this._toolTipElement);
        }

        this._toolTipElement.setAttribute("data-i18n", toolTipText);
        this._toolTipElement.setAttribute("tooltipText", toolTipText);
        this._toolTipElement.textContent = i18n.translate(toolTipText, { defaultValue: toolTipText });

        return true;
    };

    /**
     * Returns the tooltip text for this control.
     *
     * @returns {String?} - The tooltip text. Null if it's not set.
     */
    Control.prototype.getToolTip = function () {
        return this._toolTipElement && this._toolTipElement.getAttribute("tooltipText");
    };

    /**
     * Sets the collapsed state of this control.
     *
     * @param {Boolean} collapsed - The collapsed value to set.
     *
     * @returns {Boolean} - True if the control's collapsed state changes.
     *
     * @fires Autodesk.Viewing.UI.Control#COLLAPSED_CHANGED
     */
    Control.prototype.setCollapsed = function (collapsed) {
        if (!this._isCollapsible || this.isCollapsed() === collapsed) {
            return false;
        }

        if (collapsed) {
            this.container.classList.add('collapsed');
        } else {
            this.container.classList.remove('collapsed');
        }

        var event = {
            type: Control.Event.COLLAPSED_CHANGED,
            isCollapsed: collapsed
        };

        this.fireEvent(event);

        return true;
    };

    /**
     * Gets the collapsed state of this control.
     *
     * @returns {Boolean} - True if this control is collapsed.
     */
    Control.prototype.isCollapsed = function () {
        return !!this.container.classList.contains('collapsed');
    };

    /**
     * Returns whether or not this control is collapsible.
     *
     * @returns {Boolean} - True if this control can be collapsed.
     */
    Control.prototype.isCollapsible = function () {
        return this._isCollapsible;
    };

    /**
     * Adds a CSS class to this control.
     *
     * @param {String} cssClass - The name of the CSS class.
     *
     */
    Control.prototype.addClass = function (cssClass) {
        this.container.classList.add(cssClass);
    };

    /**
     * Removes a CSS class from this control.
     *
     * @param {String} cssClass - The name of the CSS class.
     *
     */
    Control.prototype.removeClass = function (cssClass) {

        this.container.classList.remove(cssClass);

    };

    /**
     * Returns the position of this control relative to the canvas.
     *
     * @returns {Object} - The top and left values of the toolbar.
     */
    Control.prototype.getPosition = function () {
        var clientRect = this.container.getBoundingClientRect();

        return { top: clientRect.top, left: clientRect.left };
    };

    /**
     * Returns the dimensions of this control.
     *
     * @returns {Object}  - The width and height of the toolbar.
     */
    Control.prototype.getDimensions = function () {
        var clientRect = this.container.getBoundingClientRect();

        return { width: clientRect.width, height: clientRect.height };
    };

    Control.prototype.setDisplay = function (value) {
        this.container.style.display = value;
    };

    return Control;
});