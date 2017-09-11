define([
    './Utils',
    './Constants'
], function (Utils, Constants) {
    'use strict';
    /**
     * @class
     * Base class for all Markups.<br>
     * A Markup is a class that is capable of rendering itself as an Svg node.<br>
     * It can also render itself into a canvas-2d context.
     * Component within {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore MarkupsCore} extension.
     *
     * Any class extending Markup should contain at least the following methods:
     * - getEditMode()
     * - set()
     * - updateStyle()
     * - setParent()
     * - setRotation()
     * - setSize()
     * - setPosition()
     * - renderToCanvas()
     * - setMetadata()
     *
     * A good reference is the rectangle markup implementation available in
     * [MarkupRectangle.js]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupRectangle}.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     *
     * @param {number} id - Identifier, populated with return value of {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#getId getId()}.
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore} editor - Markups extension
     * @param {Array} styleAttributes - Attributes for customization. Related to {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#setStyle setStyle()}.
     * @constructor
     */
    function Markup(id, editor, styleAttributes) {

        this.id = id;
        this.type = "";
        this.editor = editor;
        this.viewer = editor.viewer;
        this.position = { x: 0, y: 0 };
        this.size = { x: 0, y: 0 };
        this.rotation = 0;
        this.style = Utils.createStyle(styleAttributes, this.editor);
        this.style = Utils.copyStyle(editor.getDefaultStyle(), this.style);
        this.highlightColor = '#FAFF3C';
        this.constraintWidth = false;
        this.constraintHeight = false;
        this.constraintRotation = false;
        this.highlighted = false;
        this.selected = false;

        Utils.addTraitEventDispatcher(this);
    }


    var proto = Markup.prototype;

    proto.destroy = function () {

        this.unselect();
        this.setParent(null);
    };

    /**
     * Specifies the parent layer which will contain the markup.
     * @param {HTMLElement} parent
     */
    proto.setParent = function (parent) {

        var div = this.shape;
        div.parentNode && div.parentNode.removeChild(div);
        parent && parent.appendChild(div);
    };

    /**
     * Clones (deep-copy) the markup. Used internally by the copy/cut/paste mechanism in
     * {@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore MarkupsCore}.
     *
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.Markup} clone of the current markup
     */
    proto.clone = function () {

        var clone = Object.create(this.__proto__);
        var overrides = this.getCloneOverrides();

        for (var name in this) {

            if (!this.hasOwnProperty(name)) {
                continue;
            }

            var member = this[name];

            // Is there an override for this member?
            if (overrides.hasOwnProperty(name)) {
                clone[name] = overrides[name];
                continue;
            }

            // Member has a clone function?
            if (member['clone'] instanceof Function) {
                clone[name] = member.clone();
                continue;
            }

            // Is it a function?
            if (member instanceof Function) {
                clone[name] = member.bind(clone);
                continue;
            }

            // Is it an html node?
            if (member.nodeType) {
                clone[name] = member.cloneNode(true);
                continue;
            }

            // Just a plain object?
            if (member instanceof Object) {
                clone[name] = JSON.parse(JSON.stringify(member));
                continue;
            }

            // Ok, it seems it's just a primitive type.
            clone[name] = member;
        }

        this.cloneShape(clone);
        return clone;
    };

    proto.cloneShape = function (clone) {

        clone.shape.markup = clone.shape.childNodes.item(0);
        clone.shape.hitarea = clone.shape.childNodes.item(1);
        clone.bindDomEvents();
    };

    /**
     * Used internally by
     * {@link Autodesk.Viewing.Extensions.Markups.Core.Markup#clone clone()},
     * provides a mechanism to avoid cloning specific attributes.<br>
     * Developers only need to override this method when creating new Markup types.
     * When overriding, first call the super() implementation and then include additional attribute/value pairs to it.
     * @returns {Object} containing attributes that need not to be cloned.
     */
    proto.getCloneOverrides = function () {

        return {
            viewer: this.viewer,
            editor: this.editor,
            hammer: null,
            listeners: {}
        }
    };

    /**
     * Used internally to select a markup.<br>
     * Fires event Autodesk.Viewing.Extensions.Markups.Core.EVENT_MARKUP_SELECTED.
     */
    proto.select = function () {

        if (this.selected) {
            return;
        }

        this.selected = true;
        this.highlighted = false;
        this.updateStyle();
        this.fireEvent({ type: Constants.EVENT_MARKUP_SELECTED, markup: this });
    };

    /**
     * Used internally to signal that the current markup has been unselected.<br>
     * No event is fired.
     */
    proto.unselect = function () {

        this.selected = false;
    };

    proto.highlight = function (highlight) {

        if (this.interactionsDisabled) {
            return;
        }

        this.highlighted = highlight;
        this.updateStyle();
    };

    /**
     * Returns a copy of the markup's style.
     * @returns {Object}
     */
    proto.getStyle = function () {

        return Utils.cloneStyle(this.style);
    };

    /**
     * Used internally to set the style object. Triggers a re-render of the markup (Svg)
     * @param {Object} style - Dictionary with key/value pairs
     */
    proto.setStyle = function (style) {

        Utils.copyStyle(style, this.style);
        this.updateStyle();
    };

    /**
     * Used internally and implemented by specific Markup types to render themselves as Svg.
     */
    proto.updateStyle = function () {

    };

    /**
     * Used internally to notify the markup that it is now being edited.<br>
     * Fires event Autodesk.Viewing.Extensions.Markups.Core.EVENT_MARKUP_ENTER_EDITION.
     */
    proto.edit = function () {

        this.fireEvent({ type: Constants.EVENT_MARKUP_ENTER_EDITION, markup: this });
    };

    /**
     * Used internally to signal that it is no longer being edited.<br>
     * Fires event Autodesk.Viewing.Extensions.Markups.Core.EVENT_MARKUP_CANCEL_EDITION.
     */
    proto.cancel = function () {

        this.fireEvent({ type: Constants.EVENT_MARKUP_CANCEL_EDITION, markup: this });
    };

    /**
     * Used internally to signal that the markup is being deleted.<br>
     * Fires event Autodesk.Viewing.Extensions.Markups.Core.EVENT_MARKUP_DELETE_EDITION.
     */
    proto.deleteMarkup = function () {

        this.fireEvent({ type: Constants.EVENT_MARKUP_DELETE_EDITION, markup: this });
    };

    /**
     * Used internally to get the {@link Autodesk.Viewing.Extensions.Markups.Core.EditMode EditMode}
     * associated with the current Markup.<br>
     * Implemented by classes extending this one.
     * @returns {Autodesk.Viewing.Extensions.Markups.Core.EditMode}
     */
    proto.getEditMode = function () {

        console.warn('EditMode of markup type' + this.type + ' not defined.');
        return null;
    };

    /**
     * Used internally to get the markup's position in browser pixel space.<br>
     * Notice that (0,0) is top left.<br>
     * See also
     * [getClientSize()]{@link Autodesk.Viewing.Extensions.Markups.Core.Markup#getClientSize}.
     * @returns {*}
     */
    proto.getClientPosition = function () {

        var position = this.position;
        return this.editor.positionFromMarkupsToClient(position.x, position.y);
    };

    /**
     * Used internally to get the markup's bounding rect in browser pixel space.<br>
     * See also
     * [getClientPosition()]{@link Autodesk.Viewing.Extensions.Markups.Core.Markup#getClientPosition}.
     * @returns {*}
     */
    proto.getClientSize = function () {

        var size = this.size;
        return this.editor.sizeFromMarkupsToClient(size.x, size.y);
    };

    /**
     * Changes the rotation of the markup to the given angle.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetRotation edit action
     *
     * @param {Number} angle
     */
    proto.setRotation = function (angle) {

        this.rotation = angle;
        this.updateStyle();
    };

    proto.getRotation = function () {

        return this.rotation;
    };

    /**
     * Used by the EditFrame to move the markup in Client Space coordinates
     * @param {Number} x - New X location for the markup. Notice that markups are centered on this value.
     * @param {Number} y - New Y location for the markup. Notice that markups are centered on this value.
     */
    proto.setPosition = function (x, y) {

        this.position.x = x;
        this.position.y = y;

        this.updateStyle();
    };

    /**
     * Changes the position and size of the markup.
     * This gets called by the Autodesk.Viewing.Extensions.Markups.Core.SetSize edit action
     * @param {{x: Number, y: Number}} position
     * @param {Number} width
     * @param {Number} height
     */
    proto.setSize = function (position, width, height) {

        this.position.x = position.x;
        this.position.y = position.y;
        this.size.x = width;
        this.size.y = height;

        this.updateStyle();
    };

    proto.isWidthConstrained = function () {

        return this.constraintWidth;
    };

    proto.isHeightConstrained = function () {

        return this.constraintHeight;
    };

    proto.isRotationConstrained = function () {

        return this.constraintRotation;
    };

    /**
     * Used to disable highlight on annotations while a new annotation is being created.
     * @param {Boolean} disable - Whether (mouse) interactions are enable.
     */
    proto.disableInteractions = function (disable) {

        this.interactionsDisabled = disable;
    };

    /**
     *
     * @param width
     */
    proto.setStrokeWidth = function (width) {

    };

    proto.constrainsToBounds = function (bounds) {

    };

    proto.onMouseDown = function (event) {

        if (this.interactionsDisabled) {
            return;
        }

        this.select();
        this.editor.editFrame.startDrag(event);
    };

    /**
     *
     * @param idTarget
     * @returns *
     */
    proto.generatePoint3d = function (idTarget) {

        var viewer = this.viewer;
        var polygon = this.generateBoundingPolygon();

        function checkLineSegment(a, b) {

            var point2d = Utils.checkLineSegment(a.x, a.y, b.x, b.y, idTarget);
            var point3d = point2d && viewer.clientToWorld(point2d.x, point2d.y);
            return point3d && point3d.point;
        }

        function checkPolygon(polygon) {

            var point2d = Utils.checkPolygon(polygon, idTarget);
            var point3d = point2d && viewer.clientToWorld(point2d.x, point2d.y);
            return point3d && point3d.point;
        }

        // Try to avoid expensive calculations by checking some lines segments first.
        // If line check cannot find a point the costly one by area is used.
        // A ----midAB---- B
        // |               |
        // |     center    |
        // |               |
        // C --------------D

        var xVertices = polygon.xVertices;
        var yVertices = polygon.yVertices;

        var midAB = new THREE.Vector2(xVertices[0] + xVertices[1], yVertices[0] + yVertices[1]).multiplyScalar(0.5);
        var midAC = new THREE.Vector2(xVertices[0] + xVertices[3], yVertices[0] + yVertices[3]).multiplyScalar(0.5);
        var midDB = new THREE.Vector2(xVertices[2] + xVertices[1], yVertices[2] + yVertices[1]).multiplyScalar(0.5);
        var midDC = new THREE.Vector2(xVertices[2] + xVertices[3], yVertices[2] + yVertices[3]).multiplyScalar(0.5);
        var center = midAC.clone().add(midDB).multiplyScalar(0.5);

        var point3d =
            checkLineSegment(center, midDB) ||
            checkLineSegment(center, midAC) ||
            checkLineSegment(center, midAB) ||
            checkLineSegment(center, midDC);

        return point3d || checkPolygon(polygon);
    };

    /**
     *
     * @returns {{min: {x: number, y: number}, max: {x: number, y: number}}}
     */
    proto.generateBoundingBox = function () {

        var boundingBox = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };

        // Get bounding box from markup bounding polygon.
        var polygon = this.generateBoundingPolygon();

        var vertexCount = polygon.vertexCount;
        var xVertices = polygon.xVertices;
        var yVertices = polygon.yVertices;

        var bbX0 = Number.POSITIVE_INFINITY;
        var bbY0 = Number.POSITIVE_INFINITY;
        var bbX1 = Number.NEGATIVE_INFINITY;
        var bbY1 = Number.NEGATIVE_INFINITY;

        for (var i = 0; i < vertexCount; ++i) {

            var bbX = xVertices[i];
            var bbY = yVertices[i];

            bbX0 = Math.min(bbX0, bbX);
            bbY0 = Math.min(bbY0, bbY);
            bbX1 = Math.max(bbX1, bbX);
            bbY1 = Math.max(bbY1, bbY);
        }

        boundingBox.min.x = bbX0;
        boundingBox.min.y = bbY0;
        boundingBox.max.x = bbX1;
        boundingBox.max.y = bbY1;

        return boundingBox;
    };

    /**
     *
     * @returns {{vertexCount: number, xVertices: Float32Array, yVertices: Float32Array}}
     */
    proto.generateBoundingPolygon = function () {

        var position = this.getClientPosition();
        var halfSize = this.getClientSize();

        halfSize.x *= 0.5;
        halfSize.y *= 0.5;

        var lt = new THREE.Vector3(-halfSize.x, -halfSize.y).add(position);
        var rt = new THREE.Vector3(halfSize.x, -halfSize.y).add(position);
        var rb = new THREE.Vector3(halfSize.x, halfSize.y).add(position);
        var lb = new THREE.Vector3(-halfSize.x, halfSize.y).add(position);

        if (this.rotation !== 0) {

            var m1 = new THREE.Matrix4().makeTranslation(-position.x, -position.y, 0);
            var m2 = new THREE.Matrix4().makeRotationZ(this.rotation);
            var m3 = new THREE.Matrix4().makeTranslation(position.x, position.y, 0);
            var transform = m3.multiply(m2).multiply(m1);

            lt.applyMatrix4(transform);
            rt.applyMatrix4(transform);
            rb.applyMatrix4(transform);
            lb.applyMatrix4(transform);
        }

        return { // packed for fast access in test algorithm.
            vertexCount: 4,
            xVertices: new Float32Array([lt.x, rt.x, rb.x, lb.x]),
            yVertices: new Float32Array([lt.y, rt.y, rb.y, lb.y])
        };
    };

    /**
     * Implemented by extending classes.<br>
     * Gets called automatically when
     * [generateData()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#generateData}
     * @returns {null|Element} - Either null (default) or the metadata Svg node
     */
    proto.setMetadata = function () {

        return null; // No metadata is injected by default.
    };

    proto.bindDomEvents = function () {

        if (Utils.isTouchDevice()) {

            this.hammer = new Hammer.Manager(this.shape, {
                recognizers: [
                    [Hammer.Tap, { event: 'singletap', pointers: 1, threshold: 2 }]
                ],
                inputClass: Hammer.TouchInput
            });

            this.onSingleTapBinded = function (event) {

                this.onMouseDown(event);
            }.bind(this);

            this.hammer.on("singletap", this.onSingleTapBinded);
        }

        this.shape.addEventListener("mousedown", this.onMouseDown.bind(this), true);
        this.shape.addEventListener("mouseout", function () { this.highlight(false); }.bind(this));
        this.shape.addEventListener("mouseover", function () { this.highlight(true); }.bind(this));
    };

    proto.renderToCanvas = function (ctx) {

        var m0 = new THREE.Matrix4().makeRotationZ(-this.rotation);
        var m1 = new THREE.Matrix4().makeTranslation(this.position.x, this.position.y, 0);
        var transform = m1.multiply(m0);

        Utils.renderToCanvas(this.editor, ctx, this.getPath(), this.style, transform);
    };

    proto.getPath = function () {

    };

    proto.getTransform = function () {

        return [
            'translate(', this.position.x, ',', this.position.y, ')',
            'rotate(', Utils.radiansToDegrees(-this.rotation), ')'
        ].join(' ');
    };

    return Markup;
});