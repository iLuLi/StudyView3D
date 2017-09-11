define([
    '../../Core/Constants/DeviceType',
    'Hammer'
], function(DeviceType, Hammer) {
    'use strict';

    var Utils = {};
    // Change these constants to alter the default sizes in pixels of strokes and fonts.
    Utils.MARKUP_DEFAULT_STROKE_WIDTH_IN_PIXELS = 5;
    Utils.MARKUP_DEFAULT_FONT_WIDTH_IN_PIXELS = 12;
    Utils.MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS = 15;

    /**
     * // isTouchDevice is an LMV function. Hammer is included by LMV as well
     * @returns {boolean}
     */
    Utils.isTouchDevice = function () {
        // isTouchDevice() is an LMV function.
        // Hammer (a touch detection lib) is packaged with LMV as well
        if (DeviceType.isTouchDevice && typeof Hammer === "function") {
            return DeviceType.isTouchDevice;
        }
        return false;
    };

    //// SVG  //////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param type
     * @returns {Element}
     */
    Utils.createSvgElement = function (type) {

        // See https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS
        var namespace = 'http://www.w3.org/2000/svg';
        return document.createElementNS(namespace, type);
    };

    /**
     *
     * @param {Element} svg - an SVGElement
     * @returns {Element} svg param is returned back
     */
    Utils.setSvgParentAttributes = function (svg) {

        // See: https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course
        svg.setAttribute('version', '1.1'); // Notice that this is the SVG version, not the "MARKUP DATA VERSION"!
        svg.setAttribute('baseProfile', 'full');
        return svg;
    };

    Utils.createMarkupPathSvg = function () {

        var svg = Utils.createSvgElement('g');
        svg.setAttribute('cursor', 'inherit');
        svg.setAttribute('pointer-events', 'none');

        var markup = Utils.createSvgElement('path');
        markup.setAttribute('id', 'markup');

        var hitarea = Utils.createSvgElement('path');
        hitarea.setAttribute('id', 'hitarea');
        hitarea.setAttribute('fill', 'transparent');
        hitarea.setAttribute('stroke', 'transparent');

        svg.markup = markup;
        svg.hitarea = hitarea;

        svg.appendChild(markup);
        svg.appendChild(hitarea);

        return svg;
    };

    Utils.setAttributeToMarkupSvg = function (svg, attribute, value) {

        svg.markup.setAttribute(attribute, value);
    };

    Utils.updateMarkupPathSvgHitarea = function (svg, editor) {

        var markup = svg.markup;
        var hitarea = svg.hitarea;

        var hitareaMargin = editor.sizeFromClientToMarkups(0, Utils.MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS).y;
        hitareaMargin += parseFloat(markup.getAttribute('stroke-width')) + hitareaMargin;

        var markupFill = markup.getAttribute('fill');
        var markupStroke = markup.getAttribute('stroke');
        var strokeEnabled = markupStroke !== '' && markupStroke !== 'none';
        var fillEnabled = markupFill !== '' && markupFill !== 'none';

        hitarea.setAttribute('d', markup.getAttribute('d'));
        hitarea.setAttribute('stroke-width', hitareaMargin);
        hitarea.setAttribute('transform', markup.getAttribute('transform'));

        if (!editor.navigating) {
            if (strokeEnabled && fillEnabled) {
                svg.setAttribute('pointer-events', 'painted');
                return;
            }

            if (strokeEnabled) {
                svg.setAttribute('pointer-events', 'stroke');
                return;
            }

            if (!fillEnabled) {
                svg.setAttribute('pointer-events', 'fill');
                return;
            }
        }

        svg.setAttribute('pointer-events', 'none');
    };

    var nextClipperId = 0;
    Utils.createMarkupTextSvg = function () {

        var svg = Utils.createSvgElement('g');
        svg.setAttribute('cursor', 'default');

        var clipperId = 'markup-clipper-' + (nextClipperId++);
        var clipperUrl = 'url(#' + clipperId + ')';

        var clipper = Utils.createSvgElement('clipPath');
        clipper.setAttribute('id', clipperId);
        clipper.removeAttribute('pointer-events');
        clipper.rect = Utils.createSvgElement('rect');
        clipper.appendChild(clipper.rect);

        var background = Utils.createSvgElement('rect');
        background.setAttribute('id', 'markup-background');

        var markup = Utils.createSvgElement('text');
        markup.setAttribute('id', 'markup');
        background.removeAttribute('pointer-events');

        var hitarea = Utils.createSvgElement('rect');
        hitarea.setAttribute('id', 'hitarea');
        hitarea.setAttribute('fill', 'transparent');
        hitarea.setAttribute('stroke', 'none');
        hitarea.setAttribute('stroke-width', '0');

        var clippedArea = Utils.createSvgElement('g');
        clippedArea.setAttribute('clip-path', clipperUrl);
        clippedArea.appendChild(clipper);
        clippedArea.appendChild(background);
        clippedArea.appendChild(markup);

        svg.appendChild(clippedArea);
        svg.appendChild(hitarea);

        svg.clipper = clipper;
        svg.background = background;
        svg.markup = markup;
        svg.hitarea = hitarea;

        return svg;
    };

    Utils.setMarkupTextSvgTransform = function (svg, transform, textTransform) {

        svg.clipper.rect.setAttribute('transform', transform);
        svg.background.setAttribute('transform', transform);
        svg.markup.setAttribute('transform', textTransform);
        svg.hitarea.setAttribute('transform', transform);
    };

    Utils.updateMarkupTextSvgHitarea = function (svg, w, h, editor) {

        var hitarea = svg.hitarea;
        var hitareaMargin = editor.sizeFromClientToMarkups(0, Utils.MARKUP_DEFAULT_HITAREAS_MARGIN_IN_PIXELS).y;

        hitarea.setAttribute('x', -hitareaMargin);
        hitarea.setAttribute('y', -hitareaMargin);
        hitarea.setAttribute('width', w + hitareaMargin * 2);
        hitarea.setAttribute('height', h + hitareaMargin * 2);
        svg.setAttribute("pointer-events", editor.navigating ? "none" : "painted");
    };

    Utils.updateMarkupTextSvgBackground = function (svg, w, h, color) {

        var background = svg.background;

        background.setAttribute('x', 0);
        background.setAttribute('y', 0);
        background.setAttribute('width', w);
        background.setAttribute('height', h);
        background.setAttribute('fill', color);
    };

    Utils.updateMarkupTextSvgClipper = function (svg, w, h) {

        var clipper = svg.clipper;

        clipper.rect.setAttribute('x', 0);
        clipper.rect.setAttribute('y', 0);
        clipper.rect.setAttribute('width', w);
        clipper.rect.setAttribute('height', h);
    };

    /**
     * Helper function that injects metadata for the whole Markup document.
     * Metadata includes: version.
     * @param {Element} svg - an SVGElement
     * @param {Object} metadata - Dictionary with attributes
     */
    Utils.addSvgMetadata = function (svg, metadata) {

        var metadataNode = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
        var dataVersionNode = document.createElement('markup_document');

        metadataNode.appendChild(dataVersionNode);

        // NOTE: We could iterate over the properties, but we don't because these are the only ones supported
        dataVersionNode.setAttribute("data-model-version", metadata["data-model-version"]); // Version. For example: "1"

        svg.insertBefore(metadataNode, svg.firstChild);
        return metadataNode;
    };

    /**
     * Helper function that injects metadata for specific markup svg nodes.
     * @param {Element} markupNode - an SVGElement for the markup
     * @param {Object} metadata - Dictionary where all key/value pairs are added as metadata entries.
     * @returns {Element}
     */
    Utils.addMarkupMetadata = function (markupNode, metadata) {

        var metadataNode = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
        var dataVersionNode = document.createElement('markup_element');

        metadataNode.appendChild(dataVersionNode);
        for (var key in metadata) {
            if (metadata.hasOwnProperty(key)) {
                dataVersionNode.setAttribute(key, metadata[key]);
            }
        }

        markupNode.insertBefore(metadataNode, markupNode.firstChild);
        return metadataNode;
    };

    /**
     * Removes al metadata nodes from an Svg node structure.
     * Method will remove all metadata nodes from children nodes as well.
     * @param svgNode
     */
    Utils.removeAllMetadata = function (svgNode) {

        if (svgNode.getElementsByTagName) {
            var nodes = svgNode.getElementsByTagName("metadata");
            for (var i = 0; i < nodes.length; ++i) {
                var metadataNode = nodes[i];
                metadataNode.parentNode && metadataNode.parentNode.removeChild(metadataNode);
            }
        }

        // Transverse children nodes
        var svgChildren = svgNode.children || svgNode.childNodes;
        if (svgChildren) {
            for (i = 0; i < svgChildren.length; ++i) {
                this.removeAllMetadata(svgChildren[i]);
            }
        }
    };

    /**
     * Utility function that transfers children from an Html/Svg node into another one.
     * @param nodeFrom - The node instance from where children will be taken.
     * @param nodeInto - The node that's going to parent the transferred children.
     */
    Utils.transferChildNodes = function (nodeFrom, nodeInto) {

        var svgChildren = nodeFrom.children || nodeFrom.childNodes;
        var tmpArray = [];
        for (var i = 0; i < svgChildren.length; ++i) {
            tmpArray.push(svgChildren[i]); // Avoid appendChild
        }
        tmpArray.forEach(function (node) {
            nodeInto.appendChild(node);
        });
    };

    /**
     * Serializes an SVG node into a String.
     * @param domNode
     * @returns {string}
     */
    Utils.svgNodeToString = function (domNode) {

        function removeHitareas(svg, hitareas) {

            var hitarea = svg.hitarea;
            var hitareaParent = hitarea && hitarea.parentNode;

            if (hitareaParent) {

                hitareas.push({ hitarea: hitarea, parent: hitareaParent });
                hitareaParent.removeChild(hitarea);
            }

            var children = svg.childNodes;
            var childrenCount = children.length;

            for (var i = 0; i < childrenCount; ++i) {
                removeHitareas(children.item(i), hitareas);
            }
        }

        function addHitareas(hitareas) {

            var hitareasCount = hitareas.length;
            for (var i = 0; i < hitareasCount; ++i) {

                var hitarea = hitareas[i];
                hitarea.parent.appendChild(hitarea.hitarea);
            }
        }

        var result;
        try {
            var hitareas = [];
            removeHitareas(domNode, hitareas);

            var xmlSerializer = new XMLSerializer();
            result = xmlSerializer.serializeToString(domNode);

            addHitareas(hitareas);

        } catch (err) {
            result = '';
            console.warn('svgNodeToString failed to generate string representation of domNode.');
        }
        return result;
    };

    Utils.stringToSvgNode = function (stringNode) {

        var node = null;
        try {
            var domParser = new DOMParser();
            var doc = domParser.parseFromString(stringNode, "text/xml");
            node = doc.firstChild; // We should only be getting 1 child anyway.
        } catch (err) {
            node = null;
            console.warn('stringToSvgNode failed to generate an HTMLElement from its string representation.');
        }
        return node;
    };

    /**
     * Injects functions and members to a client object which will
     * receive the ability to dispatch events.
     * Mechanism is the same as in Autodesk.Viewing.Viewer.
     *
     * Note: All of the code here comes from Autodesk.Viewing.Viewer
     *
     * @param {Object} client - Object that will become an event dispatcher.
     */
    Utils.addTraitEventDispatcher = function (client) {

        // Inject member variable
        client.listeners = {};

        // Inject functions
        client.addEventListener = function (type, listener) {
            if (typeof this.listeners[type] == "undefined") {
                this.listeners[type] = [];
            }
            this.listeners[type].push(listener);
        };
        client.hasEventListener = function (type, listener) {
            if (this.listeners === undefined) return false;
            var listeners = this.listeners;
            if (listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1) {
                return true;
            }
            return false;
        };
        client.removeEventListener = function (type, listener) {
            if (this.listeners[type] instanceof Array) {
                var li = this.listeners[type];
                for (var i = 0, len = li.length; i < len; i++) {
                    if (li[i] === listener) {
                        li.splice(i, 1);
                        break;
                    }
                }
            }
        };
        client.fireEvent = function (event) {
            if (typeof event == "string") {
                event = { type: event };
            }
            if (!event.target) {
                event.target = this;
            }

            if (!event.type) {
                throw new Error("event type unknown.");
            }

            if (this.listeners[event.type] instanceof Array) {
                var typeListeners = this.listeners[event.type].slice();
                for (var i = 0; i < typeListeners.length; i++) {
                    typeListeners[i].call(this, event);
                }
            }
        };
    };

    /**
     * Removes the EventDispatcher trait
     *
     * @param {Object} client
     */
    Utils.removeTraitEventDispatcher = function (client) {

        try {
            delete client.listeners;
            delete client.addEventListener;
            delete client.hasEventListener;
            delete client.removeEventListener;
            delete client.fireEvent;
        } catch (e) {
            // nothing
        }
    };

    //// Math  /////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Calculates the pixel position in client space coordinates of a point in world space.
     * @param {THREE.Vector3} point Point in world space coordinates.
     * @param viewer
     * @param snap Round values to closest pixel center.
     * @returns {THREE.Vector3} Point transformed and projected into client space coordinates.
     */
    Utils.worldToClient = function (point, viewer, snap) {

        var p = Utils.worldToViewport(point, viewer);
        var result = Utils.viewportToClient(p.x, p.y, viewer);
        result.z = 0;

        // snap to the center of the
        if (snap) {
            result.x = Math.floor(result.x) + 0.5;
            result.y = Math.floor(result.y) + 0.5;
        }

        return result;
    };

    Utils.clientToWorld = function (clientX, clientY, depth, viewer) {

        var point = Utils.clientToViewport(clientX, clientY, viewer);
        point.z = depth;

        point.unproject(viewer.impl.camera);
        return point;
    };

    Utils.clientToViewport = function (clientX, clientY, viewer) {

        return viewer.impl.clientToViewport(clientX, clientY);
    };

    Utils.viewportToClient = function (viewportX, viewportY, viewer) {

        return viewer.impl.viewportToClient(viewportX, viewportY);
    };

    /**
     * Calculates the world position of a point in client space coordinates.
     * @param {Object} point - { x:Number, y:Number, z:Number }
     * @param {Object} viewer - LMV instance
     * @returns {THREE.Vector3}
     */
    Utils.worldToViewport = function (point, viewer) {

        var p = new THREE.Vector3();

        p.x = point.x;
        p.y = point.y;
        p.z = point.z;

        p.project(viewer.impl.camera);
        return p;
    };

    Utils.metersToModel = function (meters, viewer) {

        var modelToMeter = viewer.model.getUnitScale();
        var meterToModel = 1 / modelToMeter;

        return meterToModel * meters;
    };

    Utils.radiansToDegrees = function (radians) {

        return radians * (180 / Math.PI);
    };

    Utils.degreesToRadians = function (degrees) {

        return degrees * (Math.PI / 180);
    };

    /**
     *
     * @param value
     * @returns {number}
     */
    Utils.sign = function (value) {

        return (value >= 0) ? 1 : -1;
    };

    /**
     *
     * @param pointA
     * @param pointB
     * @param range
     * @param editor
     * @returns {boolean}
     */
    Utils.areMarkupsPointsInClientRange = function (pointA, pointB, range, editor) {

        range = editor.sizeFromClientToMarkups(0, range).y;

        var dx = pointA.x - pointB.x;
        var dy = pointA.y - pointB.y;

        return range * range >= dx * dx + dy * dy;
    };

    //// LMV ui ////////////////////////////////////////////////////////////////////////////////////////////////////////

    Utils.hideLmvUi = function (viewer) {

        // If the viewer is no gui, then there is nothing to hide
        if (!viewer.toolbar) {
            return;
        }

        // Exit other tools and hide HudMessages.
        viewer.setActiveNavigationTool();

        Utils.dismissLmvHudMessage();
        Utils.hideLmvPanels(true, viewer);
        Utils.hideLmvToolsAndPanels(viewer);
    };

    Utils.restoreLmvUi = function (viewer) {

        // If the viewer is no gui, then there is nothing to hide
        if (!viewer.toolbar) {
            return;
        }

        Utils.dismissLmvHudMessage();
        Utils.hideLmvPanels(false, viewer);
        Utils.showLmvToolsAndPanels(viewer);
    };

    /**
     *
     * @param hide
     * @param viewer
     */
    Utils.hideLmvPanels = function (hide, viewer) {

        var dockingPanels = viewer.dockingPanels;

        // Panels may not be present when dealing with an instance of Viewer3D.js
        // (as opposed to an instance of GuiViewer3D.js)
        if (!dockingPanels) return;

        for (var i = 0; i < dockingPanels.length; ++i) {

            var panel = dockingPanels[i];
            var panelContainer = panel.container;

            if (panelContainer.classList.contains("dockingPanelVisible")) {
                panelContainer.style.display = hide ? "none" : "block";

                // Call the visibility changed notification if any additional
                // stuff needs to be done (update the date i.e. PropertyPanel, etc).
                panel.visibilityChanged();
            }
        }
    };

    /**
     * Shows panels and tools in the viewer.
     * @param viewer
     */
    Utils.showLmvToolsAndPanels = function (viewer) {

        // Restore view cube.
        if (viewer && viewer.model && !viewer.model.is2d()) {
            viewer.displayViewCube(true, false);
        }

        // TODO: Find or ask for a better way to restore this buttons.
        // Hide home and info button.
        var home = document.getElementsByClassName('homeViewWrapper');
        var info = document.getElementsByClassName('infoButton');
        var anim = document.getElementsByClassName('toolbar-animationSubtoolbar');

        if (home.length > 0) {
            home[0].style.display = '';
        }

        if (info.length > 0) {
            info[0].style.display = '';
        }

        if (anim.length > 0) {
            anim[0].style.display = '';
        }

        // toolbar is absent when dealing with an instance of Viewer3D (instead of GuiViewer3D)
        if (viewer.toolbar) {
            var viewerContainer = viewer.toolbar.container;
            var viewerContainerChildrenCount = viewerContainer.children.length;
            for (var i = 0; i < viewerContainerChildrenCount; ++i) {
                viewerContainer.children[i].style.display = "";
            }
            viewer.centerToolBar();
        }
    };

    /**
     * Hides panels and tools in the viewer.
     * @param viewer
     */
    Utils.hideLmvToolsAndPanels = function (viewer) {

        // Hide Panels and tools.
        if (viewer && viewer.model && !viewer.model.is2d()) {
            viewer.displayViewCube(false, false);
        }

        // TODO: Find or ask for a better way to hide this buttons.
        // Hide home and info button.
        var home = document.getElementsByClassName('homeViewWrapper');
        var info = document.getElementsByClassName('infoButton');
        var anim = document.getElementsByClassName('toolbar-animationSubtoolbar');

        if (home.length > 0) {
            home[0].style.display = 'none';
        }

        if (info.length > 0) {
            info[0].style.display = 'none';
        }

        if (anim.length > 0) {
            anim[0].style.display = 'none';

            var animator = viewer.impl.keyFrameAnimator;
            if (animator && !animator.isPaused) {
                animator.pauseCameraAnimations();
                animator.pause();

                var playButton = viewer.modelTools.getControl('toolbar-animationPlay');
                if (playButton) {
                    playButton.setIcon('toolbar-animationPauseIcon');
                    playButton.setToolTip('Pause');
                }
            }
        }

        // toolbar is absent when dealing with an instance of Viewer3D (instead of GuiViewer3D)
        if (viewer.toolbar) {
            var viewerContainer = viewer.toolbar.container;
            var viewerContainerChildrenCount = viewerContainer.children.length;
            for (var i = 0; i < viewerContainerChildrenCount; ++i) {
                viewerContainer.children[i].style.display = "none";
            }
        }
    };

    /**
     * Dismisses all LMV HudMessages
     */
    Utils.dismissLmvHudMessage = function () {

        // Using try/catch block since we are accessing the Private namespace of LMV.
        try {
            var keepDismissing = true;
            while (keepDismissing) {
                keepDismissing = Autodesk.Viewing.Private.HudMessage.dismiss();
            }
        } catch (ignore) {
            // Failing to show the message is an okay fallback scenario
            console.warn("[CO2]Failed to dismiss LMV HudMessage");
        }
    };

    //// Styles ////////////////////////////////////////////////////////////////////////////////////////////////////////

    Utils.createStyle = function (attributes, editor) {

        var style = {};

        for (var i = 0; i < attributes.length; ++i) {

            style[attributes[i]] = null;
        }

        var defaults = Utils.getStyleDefaultValues(style, editor);

        for (var i = 0; i < attributes.length; ++i) {

            var attribute = attributes[i];
            style[attribute] = defaults[attribute].values[defaults[attribute].default].value;
        }

        return style;
    };

    /**
     *
     * @param source
     * @param destination
     * @returns {*}
     */
    Utils.copyStyle = function (source, destination) {

        for (var attribute in destination) {
            if (source.hasOwnProperty(attribute)) {
                destination[attribute] = source[attribute];
            }
        }

        return destination;
    };

    /**
     *
     * @param source
     * @returns {{}}
     */
    Utils.cloneStyle = function (source) {

        var clone = {};

        for (var attribute in source) {
            clone[attribute] = source[attribute];
        }

        return clone;
    };

    /**
     *
     * @param style
     * @param editor
     * @returns {{}}
     */
    Utils.getStyleDefaultValues = function (style, editor) {

        function getStrokeWidth(widthInPixels, editor) {

            var size = editor.sizeFromClientToMarkups(0, widthInPixels);
            return size.y;
        }

        function getWidths(normalWidth) {

            return {
                values: [
                    { name: 'Thin', value: normalWidth / 2 },
                    { name: 'Normal', value: normalWidth },
                    { name: 'Thick', value: normalWidth * 2 }],
                default: 1
            };
        }

        function getLineJoins() {

            return {
                values: [
                    { name: 'Miter', value: 'miter' },
                    { name: 'Round', value: 'round' },
                    { name: 'Bevel', value: 'bevel' }],
                default: 0
            };
        }

        function getFontSizes(normalWidth) {

            return {
                values: [
                    { name: 'Thin', value: normalWidth / 2 },
                    { name: 'Normal', value: normalWidth },
                    { name: 'Thick', value: normalWidth * 2 }],
                default: 1
            };
        }

        function getColors() {

            return {
                values: [
                    { name: 'red', value: '#ff0000' },
                    { name: 'green', value: '#00ff00' },
                    { name: 'blue', value: '#0000ff' },
                    { name: 'white', value: '#ffffff' },
                    { name: 'black', value: '#000000' }],
                default: 0
            };
        }

        function getOpacities(defaultTransparent) {

            return {
                values: [
                    { name: '100%', value: 1.00 },
                    { name: '75%', value: 0.75 },
                    { name: '50%', value: 0.50 },
                    { name: '25%', value: 0.25 },
                    { name: '0%', value: 0.00 }],
                default: (defaultTransparent ? 4 : 0)
            };
        }

        function getFontFamilies() {

            // TODO: Localize?
            // TODO: Validate fonts with design
            // Source: http://www.webdesigndev.com/web-development/16-gorgeous-web-safe-fonts-to-use-with-css
            return {
                values: [
                    { name: 'Arial', value: 'Arial' },
                    { name: 'Arial Black', value: 'Arial Black' },
                    { name: 'Arial Narrow', value: 'Arial Narrow' },
                    { name: 'Century Gothic', value: 'Century Gothic' },
                    { name: 'Courier New', value: 'Courier New' },
                    { name: 'Georgia', value: 'Georgia' },
                    { name: 'Impact', value: 'Impact' },
                    { name: 'Lucida Console', value: 'Lucida Console' },
                    { name: 'Tahoma', value: 'Tahoma' },
                    { name: 'Verdana', value: 'Verdana' }
                ],
                default: 0
            };
        }

        function getFontStyles() {
            return {
                values: [
                    { name: 'Normal', value: 'normal' },
                    { name: 'Italic', value: 'italic' }],
                default: 0
            };
        }

        function getFontWeights() {
            return {
                values: [
                    { name: 'Normal', value: 'normal' },
                    { name: 'Bold', value: 'bold' }],
                default: 0
            };
        }

        var values = Utils.cloneStyle(style);
        var normaStrokeWidth = getStrokeWidth(Utils.MARKUP_DEFAULT_STROKE_WIDTH_IN_PIXELS, editor);
        var normaFontWidth = getStrokeWidth(Utils.MARKUP_DEFAULT_FONT_WIDTH_IN_PIXELS, editor);

        for (var attribute in values) {

            switch (attribute) {
                case 'stroke-width':
                    values[attribute] = getWidths(normaStrokeWidth);
                    break;

                case 'stroke-linejoin':
                    values[attribute] = getLineJoins();
                    break;

                case 'font-size':
                    values[attribute] = getFontSizes(normaFontWidth);
                    break;

                case 'font-family':
                    values[attribute] = getFontFamilies();
                    break;

                case 'font-style':
                    values[attribute] = getFontStyles();
                    break;

                case 'font-weight':
                    values[attribute] = getFontWeights();
                    break;

                case 'stroke-color':
                case 'fill-color':
                    values[attribute] = getColors();
                    break;

                case 'stroke-opacity':
                    var defaultTransparent = false;
                    values[attribute] = getOpacities(defaultTransparent);
                    break;

                case 'fill-opacity':
                    var defaultTransparent = true;
                    values[attribute] = getOpacities(defaultTransparent);
                    break;

                default:
                    break;
            }
        }

        return values;
    };

    Utils.composeRGBAString = function (hexRGBString, opacity) {

        if (!hexRGBString || !opacity || opacity <= 0) {
            return 'none';
        }

        return ['rgba(' +
            parseInt('0x' + hexRGBString.substr(1, 2)), ',',
            parseInt('0x' + hexRGBString.substr(3, 2)), ',',
            parseInt('0x' + hexRGBString.substr(5, 2)), ',', opacity, ')'].join('');
    };

    //// Id Target Collision ///////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param x0
     * @param y0
     * @param x1
     * @param y1
     * @param idTarget
     */
    Utils.checkLineSegment = function (x0, y0, x1, y1, idTarget) {

        var deviceRatio = window.devicePixelRatio || 1;

        x0 *= deviceRatio;
        y0 *= deviceRatio;
        x1 *= deviceRatio;
        y1 *= deviceRatio;

        var idTargetWidth = idTarget.width;
        var idTargetHeight = idTarget.height;
        var idTargetBuffer = idTarget.buffer;

        x0 = Math.round(x0);
        x1 = Math.round(x1);
        y0 = Math.round(idTargetHeight - y0);
        y1 = Math.round(idTargetHeight - y1);

        function point(x, y) {

            x = Math.round(x);
            y = Math.round(y);

            var dx = 0;
            var dy = 0;

            for (var j = -deviceRatio; j <= deviceRatio; j += deviceRatio * 2) {
                dy += check(x, y + j) ? j : 0;
            }

            for (var i = -deviceRatio; i <= deviceRatio; i += deviceRatio * 2) {
                dx += check(x + i, y) ? i : 0;
            }

            return {
                x: Math.round(x / deviceRatio + dx),
                y: Math.round((idTargetHeight - y) / deviceRatio - dy)
            };
        }

        function check(x, y) {

            // Probably better to clip line at the beginning.
            if (x < 0 || x >= idTargetWidth ||
                y < 0 || y >= idTargetHeight) {
                return false;
            }

            var index = (y * idTargetWidth + x) * 4;
            return (
                idTargetBuffer[index] !== 0xFF ||
                idTargetBuffer[index + 1] !== 0xFF ||
                idTargetBuffer[index + 2] !== 0xFF);
        }

        // DDA Line algorithm
        var dx = (x1 - x0);
        var dy = (y1 - y0);

        var m = dx !== 0 ? dy / dx : 1;
        var x = x0;
        var y = y0;

        if (dx !== 0 && Math.abs(m) <= 1) {

            if (x0 <= x1) {
                for (; x <= x1; ++x, y += m) {
                    if (check(x, Math.round(y))) {
                        return point(x, y);
                    }
                }
            } else {
                for (; x >= x1; --x, y -= m) {
                    if (check(x, Math.round(y))) {
                        return point(x, y);
                    }
                }
            }
        } else {

            m = dx !== 0 ? 1 / m : 0;
            if (y0 <= y1) {
                for (; y <= y1; ++y, x += m) {
                    if (check(Math.round(x), y)) {
                        return point(x, y);
                    }
                }
            } else {
                for (; y >= y1; --y, x -= m) {
                    if (check(Math.round(x), y)) {
                        return point(x, y);
                    }
                }
            }
        }
    };

    /**
     *
     * @param polygon
     * @param idTarget
     */
    Utils.checkPolygon = function (polygon, idTarget) {

        // Return if incorrect parameters.
        if (!polygon || polygon.verxtexCount < 3 || !idTarget) {
            return null;
        }

        var deviceRatio = window.devicePixelRatio || 1;

        var idTargetWidth = idTarget.width;
        var idTargetHeight = idTarget.height;
        var idTargetBuffer = idTarget.buffer;

        var vertexCount = polygon.vertexCount;
        var xVertices = Float32Array.from(polygon.xVertices); // Clone to scale by device pixel ratio and to
        var yVertices = Float32Array.from(polygon.yVertices); // change y coordinates to OpenGL style.

        function point(x, y) {

            var dx = 0;
            var dy = 0;

            for (var j = -deviceRatio; j <= deviceRatio; j += deviceRatio * 2) {
                dy += check(x, y + j) ? j : 0;
            }

            for (var i = -deviceRatio; i <= deviceRatio; i += deviceRatio * 2) {
                dx += check(x + i, y) ? i : 0;
            }

            return {
                x: Math.round(x / deviceRatio) + dx,
                y: Math.round((idTargetHeight - y) / deviceRatio - dy)
            };
        }

        function check(x, y) {

            if (x < 0 || x >= idTargetWidth ||
                y < 0 || y >= idTargetHeight) {
                return false;
            }

            var index = (y * idTargetWidth + x) * 4;
            return (
                idTargetBuffer[index] !== 0xFF ||
                idTargetBuffer[index + 1] !== 0xFF ||
                idTargetBuffer[index + 2] !== 0xFF) && isInsidePolygon(x, y);
        }

        function isInsidePolygon(x, y) {

            var result = false;
            var vertexCount = polygon.vertexCount;
            for (var i = 0, j = vertexCount - 1; i < vertexCount; j = i++) {

                if (((yVertices[i] > y) != (yVertices[j] > y)) &&
                     (x < (xVertices[j] - xVertices[i]) * (y - yVertices[i]) / (yVertices[j] - yVertices[i]) + xVertices[i])) {
                    result = !result;
                }
            }
            return result;
        }

        // Change coordinates to OpenGL style and calculate polygon's bounding box.
        var bbX0 = Number.POSITIVE_INFINITY;
        var bbY0 = Number.POSITIVE_INFINITY;
        var bbX1 = Number.NEGATIVE_INFINITY;
        var bbY1 = Number.NEGATIVE_INFINITY;

        for (var i = 0; i < vertexCount; ++i) {

            var bbX = xVertices[i] = xVertices[i] * deviceRatio;
            var bbY = yVertices[i] = idTargetHeight - yVertices[i] * deviceRatio;

            bbX0 = Math.min(bbX0, bbX);
            bbY0 = Math.min(bbY0, bbY);
            bbX1 = Math.max(bbX1, bbX);
            bbY1 = Math.max(bbY1, bbY);
        }

        if (bbX1 < 0 || bbX0 > idTargetWidth ||
            bbY1 < 0 || bbY0 > idTargetHeight) {
            return null;
        }

        var bbW = Math.round(bbX1 - bbX0);
        var bbH = Math.round(bbY1 - bbY0);

        var bbCenterX = Math.round((bbX0 + bbX1) * 0.5);
        var bbCenterY = Math.round((bbY0 + bbY1) * 0.5);

        // Check
        var x = bbCenterX;
        var y = bbCenterY;

        var w = 1;
        var h = 1;

        do {

            var endX = x + w;
            var endY = y + h;

            for (; x < endX; ++x) {
                if (check(x, y)) {
                    return point(x, y);
                }
            }

            for (; y < endY; ++y) {
                if (check(x, y)) {
                    return point(x, y);
                }
            }

            if (w < bbW) {
                endX = x - ++w; ++w;
            } else {
                endX = x - w;
            }

            if (h < bbH) {
                endY = y - ++h; ++h;
            } else {
                endY = y - h;
            }

            for (; x > endX; --x) {
                if (check(x, y)) {
                    return point(x, y);
                }
            }

            for (; y > endY; --y) {
                if (check(x, y)) {
                    return point(x, y);
                }
            }
        } while (w < bbW || h < bbH);
    };

    //// CSS ///////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @returns {*}
     */
    Utils.createStyleSheet = function () {

        var style = document.createElement("style");

        // This is WebKit hack.
        style.appendChild(document.createTextNode(""));
        document.head.appendChild(style);

        return style.sheet;
    };

    /**
     *
     * @param styleSheet
     * @param selector
     * @param styles
     * @param index
     */
    Utils.addRuleToStyleSheet = function (styleSheet, selector, styles, index) {

        if ("insertRule" in styleSheet) {
            styleSheet.insertRule(selector + "{" + styles + "}", index);
        }
        else if ("addRule" in styleSheet) {
            styleSheet.addRule(selector, styles, index);
        }
    };

    //// SVG ///////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     *
     * @param lines
     * @param style
     * @param editor
     */
    Utils.measureTextLines = function (lines, style, editor) {

        // Measure div style is line style with some custom layout properties.
        var fontSize = editor.sizeFromMarkupsToClient(0, style['font-size']).y;

        var measureStyle = new Utils.DomElementStyle()
            .setAttribute('font-family', style['font-family'])
            .setAttribute('font-size', fontSize + 'px')
            .setAttribute('font-weight', style['font-weight'] ? 'bold' : '')
            .setAttribute('font-style', style['font-style'] ? 'italic' : '')

            .removeAttribute(['top', 'left', 'width', 'height', 'overflow-y'])
            .setAttribute('position', 'absolute')
            .setAttribute('white-space', 'nowrap')
            .setAttribute('float', 'left')
            .setAttribute('visibility', 'hidden')
            .getStyleString();

        // Create measure div.
        var measure = document.createElement('div');

        measure.setAttribute('style', measureStyle);
        editor.viewer.container.appendChild(measure);

        // Measure.
        var result = [];

        var linesCount = lines.length;
        for (var i = 0; i < linesCount; ++i) {

            measure.innerHTML = lines[i];
            result.push({
                line: lines[i],
                width: measure.clientWidth,
                height: measure.clientHeight
            });
        }

        // Remove measure div and return result.
        editor.viewer.container.removeChild(measure);
        return result;
    };

    Utils.createArcTo = function (x, y, xRadius, yRadius, relative, path) {

        path.push(relative ? 'a' : 'A');
        path.push(xRadius);
        path.push(yRadius);
        path.push(0);
        path.push(1);
        path.push(1);
        path.push(x);
        path.push(y);

        return path;
    };

    Utils.createEllipsePath = function (x, y, w, h, relative, path) {

        var halfW = w * 0.5;
        var halfH = h * 0.5;

        path.push(relative ? 'm' : 'M');
        path.push(x);
        path.push(y);

        Utils.createArcTo(w, 0, halfW, halfH, true, path);
        Utils.createArcTo(-w, 0, halfW, halfH, true, path);

        path.push('z');
    };

    Utils.createRectanglePath = function (x, y, w, h, relative, path) {

        path.push(relative ? 'm' : 'M');
        path.push(x);
        path.push(y);
        path.push('l');
        path.push(w);
        path.push(0);
        path.push('l');
        path.push(0);
        path.push(h);
        path.push('l');
        path.push(-w);
        path.push(0);
        path.push('z');
    };

    Utils.renderToCanvas = function (editor, ctx, path, style, transform) {

        var strokeWidth = style['stroke-width'];
        var strokeLineJoint = style['stroke-linejoin'];
        var strokeColor = style['stroke-color'];
        var strokeOpacity = style['stroke-opacity'];
        var fillColor = style['fill-color'];
        var fillOpacity = style['fill-opacity'];

        var vector3 = new THREE.Vector3(0, 0, 0);
        var rotation = new THREE.Matrix4().extractRotation(transform);
        var rotationZ = Math.atan2(rotation.elements[4], rotation.elements[0]) * 180 / Math.PI;

        var mappingFn = editor.positionFromMarkupsToClient.bind(editor);
        var mappingVectorFn = editor.vectorFromMarkupsToClient.bind(editor);
        var mappingSizeFn = editor.sizeFromMarkupsToClient.bind(editor);
        var pathLength = path.length;
        var pathClosed = false;

        for (var i = 0; i < pathLength;) {

            switch (path[i++]) {

                case 'M':
                case 'L':
                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(transform);
                    var position = mappingFn(vector3.x, vector3.y);
                    path[i++] = position.x;
                    path[i++] = position.y;
                    break;

                case 'm':
                case 'l':
                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(rotation);
                    var position = mappingVectorFn(vector3.x, vector3.y);
                    path[i++] = position.x;
                    path[i++] = position.y;
                    break;

                case 'c':
                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(rotation);
                    var cp1 = mappingVectorFn(vector3.x, vector3.y);
                    path[i++] = cp1.x;
                    path[i++] = cp1.y;

                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(rotation);
                    var cp2 = mappingVectorFn(vector3.x, vector3.y);
                    path[i++] = cp2.x;
                    path[i++] = cp2.y;

                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(rotation);
                    var end = mappingVectorFn(vector3.x, vector3.y);
                    path[i++] = end.x;
                    path[i++] = end.y;
                    break;

                case 'a':
                    var radius = mappingSizeFn(path[i], path[i + 1]);
                    path[i++] = radius.x;
                    path[i++] = radius.y;
                    path[i++] = rotationZ;
                    i++;
                    path[i] = path[i++] == 1 ? 0 : 1;

                    vector3.x = path[i];
                    vector3.y = path[i + 1];
                    vector3 = vector3.applyMatrix4(rotation);
                    var end = mappingVectorFn(vector3.x, vector3.y);
                    path[i++] = end.x;
                    path[i++] = end.y;
                    break;

                case 'Z':
                case 'z':
                    pathClosed = true;
                    break;
            }
        }

        ctx.strokeStyle = Utils.composeRGBAString(strokeColor, strokeOpacity);
        ctx.fillStyle = Utils.composeRGBAString(fillColor, fillOpacity);
        ctx.lineJoin = strokeLineJoint;
        ctx.lineWidth = editor.sizeFromMarkupsToClient(strokeWidth, 0).x;

        path = new Path2D(path.join(' '));

        if (pathClosed && fillOpacity !== 0) {
            ctx.fill(path);
        }
        ctx.stroke(path);
    };


    return Utils;
});