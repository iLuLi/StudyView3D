define([
    './EditActionManager',
    '../Extension',
    './Constants',
    './Clipboard',
    './InputHandler',
    './Utils',
    './EditFrame',
    './MarkupTool',
    './EditModeArrow',
    '../../Core/Constants/EventType',
    '../../Core/Manager/theExtensionManager'
], function(EditActionManager, Extension, Constants, Clipboard, InputHandler, Utils, EditFrame, MarkupTool, EditModeArrow, EventType, theExtensionManager) {
    'use strict';
    var PERSPECTIVE_MODE_SCALE = 1000;
    
        /**
         * @class
         * Extension used to overlay 2d markups over 2d and 3d models.
         *
         * @tutorial feature_markup
         * @param {Autodesk.Viewing.Viewer3D} viewer - Viewer instance used to operate on.
         * @param {Object} options - Same Dictionary object passed into [Viewer3D]{@link Autodesk.Viewing.Viewer3D}'s constructor.
         * [show()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#show}.
         * @param {Boolean} [options.markupDisableHotkeys] - Disables hotkeys for copy, cut, paste, duplicate, undo, redo and deselect.
         * @param {Autodesk.Viewing.ToolInterface} [options.markupToolClass] - Class override for input handling.
         * Use it to override/extend default hotkeys and/or mouse/gesture input.
         * @memberof Autodesk.Viewing.Extensions.Markups.Core
         * @constructor
         */
        function MarkupsCore(viewer, options) {
    
            Extension.call(this, viewer, options);
    
            this.options = this.options || {};
            this.markups = [];
            this.styles = {};
    
            this.duringViewMode = false;
            this.duringEditMode = false;
    
            // Add action manager.
            this.actionManager = new EditActionManager(50); // history of 50 actions.
            this.actionManager.addEventListener(Constants.EVENT_HISTORY_CHANGED, this.onEditActionHistoryChanged.bind(this));
    
            this.nextId = 0; // Used to identify markups by id during an edit session.
    
            // Clipboard.
            this.clipboard = new Clipboard(this);
    
            // Default Input handler.
            this.input = new InputHandler();
    
            // Extension will dispatch events.
            Utils.addTraitEventDispatcher(this);
    
            // Handled events.
            this.onCameraChangeBinded = this.onCameraChange.bind(this);
            this.onViewerResizeBinded = function (event) {
                // This is ugly, but we need to do this twice
                var self = this;
                // First usage is to avoid a blinking scenario
                self.onViewerResize(event);
                requestAnimationFrame(function () {
                    // Second one is to actually make it work on some resize scenarios.
                    // Check the unlikely scenario that we are no longer in view mode.
                    if (self.duringViewMode) {
                        self.onViewerResize(event);
                    }
                });
            }.bind(this);
    
            this.onMarkupSelectedBinded = this.onMarkupSelected.bind(this);
            this.onMarkupEnterEditionBinded = this.onMarkupEnterEdition.bind(this);
            this.onMarkupCancelEditionBinded = this.onMarkupCancelEdition.bind(this);
            this.onMarkupDeleteEditionBinded = this.onMarkupDeleteEdition.bind(this);
            this.onToolChangeBinded = this.onToolChange.bind(this);
    
            // Adds some css styles that create a bigger mouse area over certain elements, used mostly in mobile.
            var sheet = Utils.createStyleSheet();
            Utils.addRuleToStyleSheet(
                sheet,
                '.autodesk-markups-extension-core-make-me-bigger:after',
                'content:""; position:absolute; top:-10px; bottom:-10px; left:-10px; right:-10px;',
                0);
        }
    
        MarkupsCore.prototype = Object.create(Extension.prototype);
        MarkupsCore.prototype.constructor = MarkupsCore;
    
        /*
         * Event types
         */
    
        var proto = MarkupsCore.prototype;
    
        proto.load = function () {
    
            // Add layer where annotations will actually live
            var svg = this.svg = Utils.createSvgElement('svg');
            Utils.setSvgParentAttributes(svg);
    
            // NOTE: Required since LMV renders Y coordinates upwards,
            // while browser's Y coordinates goes downwards.
            var svgStyle = new Utils.DomElementStyle();
            svgStyle.setAttribute('position', 'absolute');
            svgStyle.setAttribute('left', '0');
            svgStyle.setAttribute('top', '0');
            svgStyle.setAttribute('transform', 'scale(1,-1)', { allBrowsers: true });
            svgStyle.setAttribute('transformOrigin', '0, 0', { allBrowsers: true });
            svg.setAttribute('style', svgStyle.getStyleString());
    
            this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    
            this.input.attachTo(this);
    
            //Instantiate edit frame.
            this.editFrame = new EditFrame(this.viewer.container, this);
            this.editFrame.addEventListener(Constants.EVENT_EDITFRAME_EDITION_START, function () { this.disableMarkupInteractions(true); }.bind(this));
            this.editFrame.addEventListener(Constants.EVENT_EDITFRAME_EDITION_END, function () { this.disableMarkupInteractions(false); }.bind(this));
    
            // Register tool
            var toolClass = this.options.markupToolClass || MarkupTool;
            this.markupTool = new toolClass();
            this.markupTool.setCoreExtension(this);
            this.markupTool.setHotkeysEnabled(!this.options.markupDisableHotkeys);
            this.viewer.toolController.registerTool(this.markupTool);
    
            return true;
        };
    
        proto.unload = function () {
    
            this.hide();
    
            this.input.detachFrom(this);
    
            if (this.markupTool) {
                this.viewer.toolController.deregisterTool(this.markupTool);
                this.markupTool = null;
            }
    
            var svg = this.svg;
            if (svg && this.onMouseDownBinded) {
                svg.removeEventListener("mousedown", this.onMouseDownBinded);
                this.onMouseDownBinded = null;
            }
            if (svg.parentNode) {
                svg.parentNode.removeChild(svg);
            }
            this.editModeSvgLayerNode = null;
            this.svg = null;
    
            return true;
        };
    
        proto.toggleEditMode = function () {
    
            if (this.duringEditMode) {
                this.leaveEditMode();
            } else {
                this.enterEditMode();
            }
        };
    
        /**
         * Enables click/touch interactions over Viewer canvas to create/draw markups.<br>
         * Exit editMode by calling [leaveEditMode()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#leaveEditMode}.<br>
         * See also:
         * [show()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#show}
         * @returns {boolean} Returns true if editMode is active
         */
        proto.enterEditMode = function () {
    
            // Return if already in edit mode.
            if (this.duringEditMode) {
                return true;
            }
    
            // If not currently shown, then show
            if (!this.duringViewMode) {
                if (!this.show()) {
                    return false; // Failed to enter view mode.
                }
            }
    
            if (!this.editModeSvgLayerNode) {
                this.editModeSvgLayerNode = Utils.createSvgElement('g');
                this.editModeSvgLayerNode.setAttribute('cursor', 'default');
            }
            this.svg.insertBefore(this.editModeSvgLayerNode, this.svg.firstChild);
            this.svg.setAttribute('cursor', 'crosshair');
    
            this.input.enterEditMode();
            this.activateTool(true);
            this.allowNavigation(false);
            this.styles = {}; // Clear EditMode styles.
            this.defaultStyle = null;
            this.duringEditMode = true;
            this.changeEditMode(new EditModeArrow(this));
            this.actionManager.clear();
            this.fireEvent({ type: Constants.EVENT_EDITMODE_ENTER });
            return true;
        };
    
        /**
         * Exits from editMode.<br>
         * See also [enterEditMode()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}
         * @returns {boolean} returns true if edit mode has been deactivated
         */
        proto.leaveEditMode = function () {
    
            var NOT_IN_EDIT_MODE = true;
            var WE_ARE_STILL_IN_EDIT_MODE = false;
    
            if (!this.duringEditMode || !this.duringViewMode) {
                return NOT_IN_EDIT_MODE;
            }
    
            var viewer = this.viewer;
            if (!viewer) {
                return WE_ARE_STILL_IN_EDIT_MODE; // something is very wrong...
            }
    
            this.editMode.destroy();
            this.editMode = null;
            this.duringEditMode = false;
    
            this.svg.removeChild(this.editModeSvgLayerNode);
            this.svg.setAttribute('cursor', 'default');
    
            this.input.leaveEditMode();
            this.editFrame.setMarkup(null);
            this.activateTool(true);
    
            this.allowNavigation(true);
            this.fireEvent({ type: Constants.EVENT_EDITMODE_LEAVE });
            return NOT_IN_EDIT_MODE;
        };
    
        proto.toggle = function () {
    
            if (this.duringViewMode) {
                this.hide();
            } else {
                this.show();
            }
        };
    
        /**
         * Enables loading of previously saved markups.<br>
         * Exit editMode by calling [hide()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#hide}.<br>
         * See also:
         * [enterEditMode()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}
         * @returns {boolean} Whether it successfully entered view mode or not.
         */
        proto.show = function () {
    
            var viewer = this.viewer;
            if (!viewer || !viewer.model) {
                return false;
            }
    
            // Return if already showing or in edit-mode.
            // Notice that edit mode requires that we are currently show()-ing.
            if (this.duringViewMode || this.duringEditMode) {
                return true;
            }
    
            viewer.addEventListener(EventType.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
            viewer.addEventListener(EventType.VIEWER_RESIZE_EVENT, this.onViewerResizeBinded);
    
            // Add parent svg of all markups.
            viewer.container.appendChild(this.svg);
    
            this.input.enterViewMode();
            Utils.hideLmvUi(viewer);
    
            // TODO: Nasty hack, currently there is no API to disable mouse highlighting in 3d models.
            // TODO: We nuke rollover function in viewer, for now, public api will be added soon.
            this.onViewerRolloverObject = viewer.impl.rolloverObject;
            viewer.impl.rolloverObject = function () { };
    
            this.activateTool(true);
            var camera = viewer.impl.camera;
            this.onViewerResize({ width: camera.clientWidth, height: camera.clientHeight });
            this.clear();
    
            // See function loadMarkups() for when the actual SVG gets added onstage //
            this.svgLayersMap = {};
            this.duringViewMode = true;
            this.allowNavigation(true);
            return true;
        };
    
        /**
         * Removes any markup currently overlaid on the viewer. It will also exit EditMode if it is active.<br>
         * See also:
         * [show()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#show}
         * @returns {boolean} Whether it successfully left view mode or not.
         */
        proto.hide = function () {
    
            var RESULT_HIDE_OK = true;
            var RESULT_HIDE_FAIL = false;
    
            var viewer = this.viewer;
            if (!viewer || !this.duringViewMode) {
                return RESULT_HIDE_OK;
            }
    
            if (this.duringEditMode) {
                if (!this.leaveEditMode()) {
                    return RESULT_HIDE_FAIL;
                }
            }
    
            viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
            viewer.removeEventListener(EventType.VIEWER_RESIZE_EVENT, this.onViewerResizeBinded);
    
            var svg = this.svg;
            svg.parentNode && svg.parentNode.removeChild(svg);
    
            // Remove all Markups and metadata (if any)
            this.unloadMarkupsAllLayers();
            Utils.removeAllMetadata(svg);
    
            this.input.leaveViewMode();
            Utils.restoreLmvUi(viewer);
            this.viewer.impl.rolloverObject = this.onViewerRolloverObject;
    
            this.activateTool(false);
            this.duringViewMode = false;
            return RESULT_HIDE_OK;
        };
    
        /**
         * Removes all markups from screen.<br>
         * Markups should have been added while in
         * [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}.
         */
        proto.clear = function () {
    
            var markups = this.markups;
            while (markups.length > 0) {
    
                var markup = markups[0];
                this.removeMarkup(markup);
                markup.destroy();
            }
    
            // At this point no other markups should be available.
            var svg = this.editModeSvgLayerNode;
            if (svg && svg.childNodes.length > 0) {
                while (svg.childNodes.length) {
                    svg.removeChild(svg.childNodes[0]);
                }
            }
        };
    
        /**
         * Returns an SVG string with the markups created so far.<br>
         * Markups should have been added while in
         * [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}.
         * @returns {string}
         */
        proto.generateData = function () {
    
            if (this.editMode) {
                this.editMode.onSave();
            }
    
            // Sanity check, remove any lingering metadata nodes
            Utils.removeAllMetadata(this.svg);
    
            var tmpNode = Utils.createSvgElement("svg");
            Utils.transferChildNodes(this.svg, tmpNode); // Transfer includes this.editModeSvgLayerNode
            Utils.transferChildNodes(this.editModeSvgLayerNode, this.svg);
    
            // version 1: first implementation.
            // version 2: added global offset to markup positions.
            // version 3: change node structure to include hitareas, hit areas are not exported.
            // version 4: scale perspective markups space by PERSPECTIVE_MODE_SCALE because bug in firefox. LMV-1150
            var metadataObject = {
                "data-model-version": "4"
            };
            var metadataNode = Utils.addSvgMetadata(this.svg, metadataObject);
            var metadataNodes = [metadataNode];
    
            // Notify each markup to inject metadata
            this.markups.forEach(function (markup) {
                var addedNode = markup.setMetadata();
                if (addedNode) {
                    metadataNodes.push(addedNode);
                }
            });
    
            // Generate the data!
            var data = Utils.svgNodeToString(this.svg);
    
            // Remove metadataObject before returning
            metadataNodes.forEach(function (metadataNode) {
                metadataNode.parentNode.removeChild(metadataNode);
            });
    
            Utils.transferChildNodes(this.svg, this.editModeSvgLayerNode);
            Utils.transferChildNodes(tmpNode, this.svg);
            tmpNode = null; // get rid of it.
    
            return data;
        };
    
        /**
         *
         */
        proto.generatePoints3d = function () {
    
            var result = { markups: [], main: null };
            var markups = this.markups;
            var markupsCount = markups.length;
    
            if (markupsCount === 0) {
                return result;
            }
    
            // Gather a 3d point for markup.
            var idTarget = this.viewer.impl.renderer().readbackTargetId();
            for (var i = 0; i < markupsCount; ++i) {
    
                var markup = markups[i];
                var point = markup.generatePoint3d(idTarget) || null;
                result.markups.push(
                    {
                        id: markup.id,
                        type: markup.type,
                        point: point || null
                    });
            }
    
    
            // If there is 3d point associated with an arrow, we use that as main point.
            if (markupsCount === 1) {
    
                var main = result.markups[0].point;
                result.main = main && main.clone();
                return result;
            }
    
            for (var i = 0; i < markupsCount; ++i) {
    
                var collision = result.markups[i];
                if (collision.type === Constants.MARKUP_TYPE_ARROW && collision.point !== null) {
    
                    result.main = collision.point.clone();
                    return result;
                }
            }
    
            // If there is no arrows, we average bounding boxes and get a 3d point inside it.
            var bbX0 = Number.POSITIVE_INFINITY;
            var bbY0 = Number.POSITIVE_INFINITY;
            var bbX1 = Number.NEGATIVE_INFINITY;
            var bbY1 = Number.NEGATIVE_INFINITY;
    
            for (var i = 0; i < markupsCount; ++i) {
    
                var boundingBox = markups[i].generateBoundingBox();
    
                bbX0 = Math.min(bbX0, boundingBox.min.x);
                bbY0 = Math.min(bbY0, boundingBox.min.y);
                bbX1 = Math.max(bbX1, boundingBox.max.x);
                bbY1 = Math.max(bbY1, boundingBox.max.y);
            }
    
            var polygon = {};
    
            polygon.vertexCount = 4;
            polygon.xVertices = new Float32Array([bbX0, bbX1, bbX1, bbX0]);
            polygon.yVertices = new Float32Array([bbY0, bbY0, bbY1, bbY1]);
    
            var point2d = Utils.checkPolygon(polygon, idTarget);
            var point3d = point2d && this.viewer.clientToWorld(point2d.x, point2d.y);
            result.main = point3d && point3d.point;
    
            return result;
        };
    
        /**
         * Renders markups currently present on the canvas to be rendered into a &lt;canvas&gt; 2d context.<br>
         * Internally, it will use each EditMode's renderToCanvas() api.<br>
         * The intended use-case is to generate an image.
         * @param {CanvasRenderingContext2D} context
         */
        proto.renderToCanvas = function (context) {
    
            this.markups.forEach(function (markup) {
                context.save();
                markup.renderToCanvas(context);
                context.restore();
            });
        };
    
        /**
         * Changes the active drawing tool.<br>
         * Use this method to change from, for example: the Arrow drawing tool into the Rectangle drawing tool.<br>
         * Applicable only while in [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}.<br>
         * Fires EVENT_EDITMODE_CHANGED
         * @param editMode
         */
        proto.changeEditMode = function (editMode) {
    
            var oldEditMode = this.editMode;
            oldEditMode && oldEditMode.destroy();
    
            editMode.addEventListener(Constants.EVENT_EDITMODE_CREATION_BEGIN, function () { this.disableMarkupInteractions(true); }.bind(this));
            editMode.addEventListener(Constants.EVENT_EDITMODE_CREATION_END, function () { this.disableMarkupInteractions(false); }.bind(this));
            editMode.addEventListener(Constants.EVENT_MARKUP_DESELECT, function (event) { this.fireEvent(event); }.bind(this));
    
            this.editMode = editMode;
            this.styles[editMode.type] = Utils.cloneStyle(editMode.getStyle());
    
            this.fireEvent({ type: Constants.EVENT_EDITMODE_CHANGED, target: editMode });
        };
    
        /**
         * While extension is active, the user is allowed to draw markups. Thee is also support
         * for panning and zooming but only for orthographic cameras.<br>
         * This method can be used to check whether a user can perform camera navigation operation
         * on the current loaded model.
         *
         * @return {Boolean} Whether [allowNavigation()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#allowNavigation} can succeed.
         */
        proto.isNavigationAllowed = function () {
    
            return !this.viewer.impl.camera.isPerspective;
        };
    
        /**
         * While in [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode},
         * it switches the click/tap/swipe behavior to allow camera zoom and panning operations.
         *
         * @param {Boolean} allow - Whether camera navigation interactions are active or not.
         */
        proto.allowNavigation = function (allow) {
    
            // Navigation is not allowed while in perspective mode.
            if (allow && (this.duringEditMode || this.duringViewMode) && !this.isNavigationAllowed()) {
                return false;
            }
    
            var editMode = this.editMode;
            this.navigating = allow;
    
            if (allow) {
                this.svg.setAttribute("pointer-events", "none");
                editMode && this.selectMarkup(null);
            } else {
                this.svg.setAttribute("pointer-events", "painted");
            }
    
            // Update pointer events for all markups.
            var markups = this.markups;
            var markupsCount = markups.length;
    
            for (var i = 0; i < markupsCount; ++i) {
                markups[i].updateStyle();
            }
    
            this.markupTool.allowNavigation(allow);
            editMode && editMode.notifyAllowNavigation(allow);
        };
    
        /**
         * Sets mouse/tap interactions with all Markups present while in
         * [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}.
         * @param {Boolean} disable - Whether markups will interact with mouse/tap actions.
         */
        proto.disableMarkupInteractions = function (disable) {
    
            this.markups.forEach(function (markup) { markup.disableInteractions(disable); });
        };
    
        /**
         *
         * @param isActive
         * @private
         */
        MarkupsCore.prototype.activateTool = function (isActive) {
            if (isActive) {
                if (!this.cachedNavigationTool) {
                    this.cachedNavigationTool = this.viewer.getActiveNavigationTool();
                    this.viewer.addEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChangeBinded);
                }
                this.viewer.setActiveNavigationTool(this.markupTool.getName());
            } else {
    
                if (this.cachedNavigationTool) {
                    this.viewer.setActiveNavigationTool(this.cachedNavigationTool);
                    this.cachedNavigationTool = null;
                } else {
                    var defaultToolName = this.viewer.getDefaultNavigationToolName();
                    this.viewer.setActiveNavigationTool(defaultToolName);
                }
    
                this.viewer.removeEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChangeBinded);
            }
        };
    
        /**
         *
         * @param event
         * @private
         */
        MarkupsCore.prototype.onToolChange = function (event) {
    
            if (event.toolName !== this.markupTool.getName())
                return;
    
            if (event.active) {
                var navAllowed = this.isNavigationAllowed();
                this.viewer.setNavigationLockSettings({
                    pan: navAllowed,
                    zoom: navAllowed,
                    orbit: false,
                    roll: false,
                    fov: false,
                    walk: false,
                    gotoview: false
                });
            }
            this.viewer.setNavigationLock(event.active);
        };
    
        //// Input /////////////////////////////////////////////////////////////////////////////////////////////////////////
    
        proto.changeInputHandler = function (inputHandler) {
    
            this.input.detachFrom(this);
            inputHandler.attachTo(this);
            this.input = inputHandler;
    
            if (this.duringEditMode) {
                inputHandler.enterEditMode();
            }
    
            if (this.duringViewMode) {
                inputHandler.enterViewMode();
            }
        };
    
        //// Copy and Paste System /////////////////////////////////////////////////////////////////////////////////////////
    
        /**
         * Standard copy operation. Applies to any selected Markup. It has effect only when a markup is selected.<br>
         * See also
         * [cut()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#cut} and
         * [paste()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#paste}.
         */
        proto.copy = function () {
    
            this.clipboard.copy();
        };
    
        /**
         * Standard cut operation. Applies to any selected Markup, which gets removed from screen at call time.<br>
         * See also
         * [copy()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#copy} and
         * [paste()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#paste}.
         */
        proto.cut = function () {
    
            this.clipboard.cut();
        };
    
        /**
         * Standard paste operation. Will paste add to stage any previously copied or cut markup.
         * Can be called repeatedly after after a single copy or cut operation.<br>
         * See also
         * [copy()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#copy} and
         * [cut()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#cut}.
         */
        proto.paste = function () {
    
            this.clipboard.paste();
        };
    
        //// Undo and Redo System //////////////////////////////////////////////////////////////////////////////////////////
        /**
         * Will undo the previous operation.<br>
         * The Undo/Redo stacks will track any change done through an EditAction.<br>
         * See also
         * [redo()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#redo},
         * [isUndoStackEmpty()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#isUndoStackEmpty}.
         */
        proto.undo = function () {
    
            this.actionManager.undo();
        };
    
        /**
         * Will redo and previously undo operation.<br>
         * See also
         * [undo()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#undo},
         * [isRedoStackEmpty()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#isRedoStackEmpty}.
         */
        proto.redo = function () {
    
            this.actionManager.redo();
        };
    
        /**
         * Returns true when [undo()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#undo}
         * will produce no changes.
         * @return {Boolean}
         */
        proto.isUndoStackEmpty = function () {
    
            return this.actionManager.isUndoStackEmpty();
        };
    
        /**
         * Returns true when [redo()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#redo}
         * will produce no changes.
         * @return {Boolean}
         */
        proto.isRedoStackEmpty = function () {
    
            return this.actionManager.isRedoStackEmpty();
        };
    
        proto.beginActionGroup = function () {
    
            this.actionManager.beginActionGroup();
        };
    
        proto.closeActionGroup = function () {
    
            this.actionManager.closeActionGroup();
        };
    
        proto.cancelActionGroup = function () {
    
            this.actionManager.cancelActionGroup();
        };
    
        /**
         * Helper function for generating unique markup ids.
         * @returns {number}
         */
        proto.getId = function () {
    
            return ++this.nextId;
        };
    
        /**
         * @param event
         * @private
         */
        proto.onEditActionHistoryChanged = function (event) {
    
            var data = event.data;
            var editMode = this.editMode;
    
            var keepSelection = editMode && editMode.selectedMarkup && editMode.selectedMarkup.id === data.targetId;
    
            if ((data.action !== 'undo' && data.targetId !== -1) ||
                data.action === 'undo' && keepSelection) {
    
                // Markup can be null when deleting, that's ok, we unselect in that case.
                var markup = this.getMarkup(data.targetId);
                this.selectMarkup(markup);
            }
    
            this.fireEvent(event);
        };
    
        /**
         * Returns a markup with the specified id. Returns null when not found.<br>
         * See also:
         * [getSelection()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#getSelection}.
         * @param {String} id Markup identifier.
         * @returns {Autodesk.Viewing.Extensions.Markups.Core.Markup}
         */
        proto.getMarkup = function (id) {
    
            var markups = this.markups;
            var markupsCount = markups.length;
    
            for (var i = 0; i < markupsCount; ++i) {
                if (markups[i].id == id) {
                    return markups[i];
                }
            }
    
            return null;
        };
    
    
        /**
         * Selects a markup.  A selected markup gets an overlayed UI that allows transformations such
         * as resizing, rotations and translation.<br>
         * Allows sending null to remove selection from the currently selected markup.
         * See also:
         * [getMarkup()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#getMarkup}.
         * @param {Autodesk.Viewing.Extensions.Markups.Core.Markup|null} markup Markup instance to select, or null.
         */
        proto.selectMarkup = function (markup) {
    
            if (markup) {
    
                if (this.editMode.type === markup.type) {
                    this.editMode.setSelection(markup);
                } else {
    
                    var editMode = markup.getEditMode();
                    editMode.setSelection(null);
    
                    this.changeEditMode(editMode);
                    this.setStyle(markup.getStyle());
                    this.editMode.setSelection(markup);
                }
            } else {
    
                this.editMode.setSelection(null);
            }
        };
    
        /**
         * Returns the currently selected Markup.  A selected markup has custom UI overlayed that allows for
         * resizing, rotation and translation.<br>
         * See also:
         * [selectMarkup()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#selectMarkup}.
         * @returns {Autodesk.Viewing.Extensions.Markups.Core.Markup|null}
         */
        proto.getSelection = function () {
    
            return this.editMode.getSelection();
        };
    
        /**
         * Deletes a markup from the scene. Applies only while in
         * [Edit Mode]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#enterEditMode}.
         * @param {Autodesk.Viewing.Extensions.Markups.Core.Markup} markup
         * @param {Boolean} [dontAddToHistory] Whether delete action can be [undone]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#undo}.
         */
        proto.deleteMarkup = function (markup, dontAddToHistory) {
    
            var editMode = markup.getEditMode();
            editMode.deleteMarkup(markup, dontAddToHistory);
        };
    
        proto.addMarkup = function (markup) {
    
            markup.setParent(this.editModeSvgLayerNode);
    
            markup.addEventListener(Constants.EVENT_MARKUP_SELECTED, this.onMarkupSelectedBinded);
            markup.addEventListener(Constants.EVENT_MARKUP_ENTER_EDITION, this.onMarkupEnterEditionBinded);
            markup.addEventListener(Constants.EVENT_MARKUP_CANCEL_EDITION, this.onMarkupCancelEditionBinded);
            markup.addEventListener(Constants.EVENT_MARKUP_DELETE_EDITION, this.onMarkupDeleteEditionBinded);
    
            this.markups.push(markup);
        };
    
        /**
         *
         * @param markup
         * @private
         */
        proto.removeMarkup = function (markup) {
    
            markup.setParent(null);
    
            markup.removeEventListener(Constants.EVENT_MARKUP_SELECTED, this.onMarkupSelectedBinded);
            markup.removeEventListener(Constants.EVENT_MARKUP_ENTER_EDITION, this.onMarkupEnterEditionBinded);
            markup.removeEventListener(Constants.EVENT_MARKUP_CANCEL_EDITION, this.onMarkupCancelEditionBinded);
            markup.removeEventListener(Constants.EVENT_MARKUP_DELETE_EDITION, this.onMarkupDeleteEditionBinded);
    
            var markups = this.markups;
            var markupsIndex = markups.indexOf(markup);
            if (markupsIndex !== -1) {
                markups.splice(markupsIndex, 1);
            }
    
            var editMode = this.editMode;
            if (editMode) {
                var selectedMarkup = editMode.getSelection();
                if (selectedMarkup === markup) {
                    this.selectMarkup(null);
                }
            }
        };
    
        //// Markups style /////////////////////////////////////////////////////////////////////////////////////////////////
    
        proto.setStyle = function (style) {
    
            var styles = this.styles;
            var editMode = this.editMode;
    
            Utils.copyStyle(style, styles[editMode.type]);
            editMode.setStyle(styles[editMode.type]);
        };
    
        proto.getStyle = function () {
    
            return Utils.cloneStyle(this.styles[this.editMode.type]);
        };
    
        proto.getDefaultStyle = function () {
    
            var defaultStyleAttributes = [
                'stroke-width',
                'font-size',
                'font-family',
                'font-style',
                'font-weight',
                'stroke-color',
                'stroke-opacity',
                'fill-color',
                'fill-opacity'];
            this.defaultStyle = this.defaultStyle || Utils.createStyle(defaultStyleAttributes, this);
    
            return this.defaultStyle;
        };
    
        //// Markups depth order ///////////////////////////////////////////////////////////////////////////////////////////
    
        /**
         *
         * @param markup
         */
        proto.bringToFront = function (markup) {
    
            this.sendMarkupTo(markup, this.markups.length - 1);
        };
    
        /**
         *
         * @param markup
         */
        proto.sendToBack = function (markup) {
    
            this.sendMarkupTo(markup, 0);
        };
    
        /**
         *
         * @param markup
         */
        proto.bringForward = function (markup) {
    
            var markupIndex = this.markups.indexOf(markup);
            this.sendMarkupTo(markup, markupIndex + 1);
        };
    
        /**
         *
         * @param markup
         */
        proto.bringBackward = function (markup) {
    
            var markupIndex = this.markups.indexOf(markup);
            this.sendMarkupTo(markup, markupIndex - 1);
        };
    
        /**
         *
         * @param markup
         * @param index
         * @private
         */
        proto.sendMarkupTo = function (markup, index) {
    
            var markups = this.markups;
            var markupIndex = markups.indexOf(markup);
    
            if (markupIndex === -1 || index < 0 || index >= markups.length) {
                return;
            }
    
            markups.splice(markupIndex, 1);
            index = markupIndex > index ? index - 1 : index;
            markups.splice(index, 0, markup);
    
            // TODO: Add markup in right position not always at the end.
            markup.setParent(null);
            markup.setParent(this.editModeSvgLayerNode);
        };
    
        //// Serialization and Restoration of Markups  /////////////////////////////////////////////////////////////////////
    
        /**
         * Overlays Markup data (SVG string) onto viewer's canvas. A layerId is required to group markups and reference
         * them in operations such as
         * [hideMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#hideMarkups}.<br>
         *
         * See also:
         * [unloadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#unloadMarkups},
         * [hideMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#hideMarkups}.
         *
         * @param {String} markupString - svg string with markups. See also [generateData()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#generateData}.
         * @param {String} layerId - Identifier for the layer where the markup should be loaded to. Example "Layer1".
         * @return {Boolean} Whether the markup string was able to be loaded successfully
         */
        proto.loadMarkups = function (markupString, layerId) {
    
            var self = this;
            var viewer = self.viewer;
            var camera = viewer.impl.camera;
    
            var pre2ClientToMarkups = function (x, y) {
                var point = Utils.clientToWorld(x, y, 0, viewer);
                point.add(camera.position).applyMatrix4(camera.matrixWorldInverse);
                point.z = 0;
                return point;
            };
    
            var pre4ClientToMarkups = function (x, y) {
    
                var camera = self.viewer.impl.camera;
                var point = Utils.clientToWorld(x, y, 0, self.viewer);
    
                // In LMV model is offset by a global offset, we correct this offset when transforming to markups space, so
                // exported markups don't have the offset.
                var globalOffset = self.viewer.model.getData().globalOffset;
                if (globalOffset) {
                    point.sub(globalOffset);
                }
    
                point.add(camera.position);
                point.applyMatrix4(camera.matrixWorldInverse);
                point.z = 0;
    
                return point;
            };
    
            if (!this.duringViewMode) {
                return false;
            }
    
            if (!layerId) {
                console.warn("loadMarkups failed; missing 2nd argument 'layerId'");
                return false;
            }
    
            // Can it be parsed into SVG?
            var parent = Utils.stringToSvgNode(markupString);
            if (!parent) {
                return false;
            }
    
            var metadata = parent.childNodes[0].childNodes[0];
            var version = parseFloat(metadata.getAttribute('data-model-version'));
    
            // Apply global offset if needed.
            var offset = { x: 0, y: 0 };
            var globalOffset = this.viewer.model.getData().globalOffset;
    
            if (version < 2 && globalOffset) {
                var pre2Offset = pre4ClientToMarkups(0, 0).sub(pre2ClientToMarkups(0, 0));
                offset.x += pre2Offset.x;
                offset.y += pre2Offset.y;
            }
    
            if (version < 4 && globalOffset && !camera.isPerspective) {
                var pre4Offset = this.clientToMarkups(0, 0).sub(pre4ClientToMarkups(0, 0));
                offset.x += pre4Offset.x;
                offset.y += pre4Offset.y;
            }
    
            // Scale perspective markups space if needed.
            var scale = null;
    
            if (version < 4 && camera.isPerspective) {
                scale = PERSPECTIVE_MODE_SCALE;
            }
    
            // Remove all metadata nodes
            Utils.removeAllMetadata(parent);
    
            // Create svg node for layer (if not present)
            var svgLayerNode = this.svgLayersMap[layerId];
            if (!svgLayerNode) {
                svgLayerNode = Utils.createSvgElement('g');
                this.svg.appendChild(svgLayerNode);
                this.svgLayersMap[layerId] = svgLayerNode;
            }
    
            var children = parent.childNodes;
            while (children.length) {
                var child = children[0];
                var childTransform = child.getAttribute('transform') || '';
    
                if (offset.x !== 0 || offset.y !== 0) {
                    childTransform = 'translate(' + offset.x + ', ' + offset.y + ') ' + childTransform;
                }
    
                if (scale) {
                    childTransform = 'scale(' + scale + ', ' + scale + ') ' + childTransform;
                }
    
                if (offset || scale) {
                    child.setAttribute('transform', childTransform);
                }
                svgLayerNode.appendChild(child);
                child.setAttribute("pointer-events", "none");
            }
            return true;
        };
    
        /**
         * Removes Markups from DOM, which is good to free up some memory.<br>
         *
         * See also:
         * [loadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#loadMarkups},
         * [unloadMarkupsAllLayers()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#unloadMarkupsAllLayers}.
         *
         * @param {String} layerId - Id of the layer containing all markups to unload (from DOM).
         * @return {Boolean} Whether the operation succeeded or not.
         */
        proto.unloadMarkups = function (layerId) {
    
            if (!layerId) {
                console.warn("unloadMarkups failed; No layerId provided.");
                return false;
            }
    
            var svgLayerNode = this.svgLayersMap[layerId];
            if (!svgLayerNode) {
                // TODO: Do we need to log anything here?
                return false;
            }
    
            this.svg.removeChild(svgLayerNode);
            delete this.svgLayersMap[layerId];
            return true;
        };
    
        /**
         * Unload all markups loaded so far. Great for freeing up memory.
         *
         * See also:
         * [loadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#loadMarkups},
         * [unloadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#unloadMarkups}.
         */
        proto.unloadMarkupsAllLayers = function () {
    
            for (var layerId in this.svgLayersMap) {
                if (this.svgLayersMap.hasOwnProperty(layerId)) {
                    this.svg.removeChild(this.svgLayersMap[layerId]);
                }
            }
            this.svgLayersMap = {};
        };
    
        /**
         * Hides all markups from a specified layer. Note that markups will be hidden and not unloaded,
         * thus memory will still be consumed to keep them around. However, no additional parsing is required
         * to make them visible again through method
         * [showMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#showMarkups}.
         *
         * See also:
         * [showMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#showMarkups},
         * [unloadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#unloadMarkups},
         * [loadMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#loadMarkups}.
         *
         * @param {String} layerId - Id of the layer containing all markups to unload (from DOM).
         * @return {Boolean} Whether the operation succeeded or not.
         */
        proto.hideMarkups = function (layerId) {
    
            if (!layerId) {
                console.warn("hideMarkups failed; No layerId provided.");
                return false;
            }
    
            var svgLayerNode = this.svgLayersMap[layerId];
            if (!svgLayerNode) {
                // TODO: Do we need to log anything here?
                return false;
            }
    
            svgLayerNode.setAttribute("visibility", "hidden");
        };
    
        /**
         * Sets a layer containing markups visible again.  Markups can be set non-visible by calling
         * [hideMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#hideMarkups}.
         *
         * See also:
         * [hideMarkups()]{@link Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore#hideMarkups}.
         *
         * @param {String} layerId - Id of the layer containing all markups to unload (from DOM).
         * @return {Boolean} Whether the operation succeeded or not.
         */
        proto.showMarkups = function (layerId) {
    
            if (!layerId) {
                console.warn("showMarkups failed; No layerId provided.");
                return false;
            }
    
            var svgLayerNode = this.svgLayersMap[layerId];
            if (!svgLayerNode) {
                // TODO: Do we need to log anything here?
                return false;
            }
    
            svgLayerNode.setAttribute("visibility", "visible");
        };
    
        //// Client Space <-> Markup Space /////////////////////////////////////////////////////////////////////////////////
    
        proto.positionFromClientToMarkups = function (x, y) {
    
            return this.clientToMarkups(x, y);
        };
    
        proto.positionFromMarkupsToClient = function (x, y) {
    
            return this.markupsToClient(x, y);
        };
    
        proto.vectorFromClientToMarkups = function (x, y) {
    
            var a = this.clientToMarkups(0, 0);
            var b = this.clientToMarkups(x, y);
    
            return { x: b.x - a.x, y: b.y - a.y };
        };
    
        proto.vectorFromMarkupsToClient = function (x, y) {
    
            var a = this.markupsToClient(0, 0);
            var b = this.markupsToClient(x, y);
    
            return { x: b.x - a.x, y: b.y - a.y };
        };
    
        proto.sizeFromClientToMarkups = function (w, h) {
    
            var a = this.clientToMarkups(0, 0);
            var b = this.clientToMarkups(w, h);
    
            return { x: Math.abs(b.x - a.x), y: Math.abs(b.y - a.y) };
        };
    
        proto.sizeFromMarkupsToClient = function (w, h) {
    
            var a = this.markupsToClient(0, 0);
            var b = this.markupsToClient(w, h);
    
            return { x: Math.abs(b.x - a.x), y: Math.abs(b.y - a.y) };
        };
    
        proto.markupsToClient = function (x, y) {
    
            var camera = this.viewer.impl.camera;
            var point = new THREE.Vector3(x, y, 0);
    
            if (camera.isPerspective) {
    
                var bb = this.viewer.impl.canvas.getBoundingClientRect();
    
                point.x = (point.x / PERSPECTIVE_MODE_SCALE * (bb.height * 0.5) + bb.width * 0.5);
                point.y = (-point.y / PERSPECTIVE_MODE_SCALE * (bb.height * 0.5) + bb.height * 0.5);
            } else {
    
                point.applyMatrix4(camera.matrixWorld);
                point.sub(camera.position);
    
                // In LMV model is offset by a global offset, we correct this offset when transforming to markups space, so
                // exported markups don't have the offset.
                var globalOffset = this.viewer.model.getData().globalOffset;
                if (globalOffset) {
                    point.sub(globalOffset);
                }
    
                point = Utils.worldToClient(point, this.viewer, false);
                point.z = 0;
            }
    
            return point;
        };
    
        proto.clientToMarkups = function (x, y) {
    
            var camera = this.viewer.impl.camera;
            var point = new THREE.Vector3(x, y, 0);
    
            if (camera.isPerspective) {
    
                var bb = this.viewer.impl.canvas.getBoundingClientRect();
    
                // Multiply by PERSPECTIVE_MODE_SCALE because Firfox on Windows machines have problems to deal with very small paths.
                point.x = (point.x - bb.width * 0.5) / (bb.height * 0.5) * PERSPECTIVE_MODE_SCALE;
                point.y = -(point.y - bb.height * 0.5) / (bb.height * 0.5) * PERSPECTIVE_MODE_SCALE;
            } else {
    
                point = Utils.clientToWorld(point.x, point.y, 0, this.viewer);
    
                // In LMV model is offset by a global offset, we correct this offset when transforming to markups space, so
                // exported markups don't have the offset.
                var globalOffset = this.viewer.model.getData().globalOffset;
                if (globalOffset) {
                    point.add(globalOffset);
                }
    
                point.add(camera.position);
                point.applyMatrix4(camera.matrixWorldInverse);
                point.z = 0;
            }
    
            return point;
        };
    
        proto.getSvgViewBox = function (clientWidth, clientHeight) {
    
            // Get pan offset.
            var lt = this.clientToMarkups(0, 0);
            var rb = this.clientToMarkups(clientWidth, clientHeight);
    
            var l = Math.min(lt.x, rb.x);
            var t = Math.min(lt.y, rb.y);
            var r = Math.max(lt.x, rb.x);
            var b = Math.max(lt.y, rb.y);
    
            return [l, t, r - l, b - t].join(' ');
        };
    
        proto.getBounds = function () {
    
            return this.bounds;
        };
    
        proto.getMousePosition = function () {
    
            return this.input.getMousePosition();
        };
    
        //// Handled Events ////////////////////////////////////////////////////////////////////////////////////////////////
    
        proto.onCameraChange = function (event) {
    
            // Update annotations' parent transform.
            var viewBox = this.getSvgViewBox(this.bounds.width, this.bounds.height);
    
            // HACK, for some reason the 2nd frame returns an empty canvas.
            // The reason why this happens is that the code above calls into the viewer
            // and a division by zero occurs due to LMV canvas having zero width and height
            // When we detect this case, avoid setting the viewBox value and rely on one
            // previously set.
            if (viewBox === "NaN NaN NaN NaN") {
                return;
            }
    
            this.svg.setAttribute('viewBox', viewBox);
    
            // Edit frame has to be updated, re-setting the selected markup does the job.
            var editMode = this.editMode;
            if (editMode) {
                var selectedMarkup = editMode.getSelection();
                this.editFrame.setMarkup(selectedMarkup);
            }
        };
    
        proto.onViewerResize = function (event) {
    
            this.bounds.x = 0;
            this.bounds.y = 0;
            this.bounds.width = event.width;
            this.bounds.height = event.height;
    
            this.svg.setAttribute('width', this.bounds.width);
            this.svg.setAttribute('height', this.bounds.height);
    
            this.onCameraChange();
        };
    
        /**
         * Handler to mouse move events, used to create markups.
         * @private
         */
        proto.onMouseMove = function (event) {
    
            if (this.navigating) {
                return;
            }
    
            if (this.editFrame.isActive() && event.type === 'mousemove') {
                this.editFrame.onMouseMove(event);
            }
    
            this.editMode && this.editMode.onMouseMove(event);
        };
    
        /**
         * Handler to mouse down events, used to start creation markups.
         * @private
         */
        var mouseDownTimeStamp = 0;
        var mouseDownType = '';
        proto.onMouseDown = function (event) {
    
            // We have mousedown and singletap events fired on mobile for the same user tap.
            // This fix only let pass one of those events.
            // TODO: Remove this code when using LMV event system instead of ours.
            var timeStamp = performance.now();
            if (timeStamp - mouseDownTimeStamp < 400 && mouseDownType !== event.type) {
                return;
            }
            mouseDownTimeStamp = timeStamp;
            mouseDownType = event.type;
    
            Utils.dismissLmvHudMessage();
    
            var bounds = this.getBounds();
            var mousePosition = this.getMousePosition();
    
            if (mousePosition.x >= bounds.x && mousePosition.x <= bounds.x + bounds.width &&
                mousePosition.y >= bounds.y && mousePosition.y <= bounds.y + bounds.height) {
                this.editMode.onMouseDown(event);
            }
    
            // TODO: There is a better way to do this, implement when undo/redo group.
            if (!this.editMode.creating && event.target === this.svg) {
                this.selectMarkup(null);
            }
            this.ignoreNextMouseUp = false;
        };
    
        var mouseUpTimeStamp = 0;
        var mouseUpType = '';
        proto.onMouseUp = function (event) {
    
            // We have mousedown and singletap events fired on mobile for the same user tap.
            // This fix only let pass one of those events.
            // TODO: Remove this code when using LMV event system instead of ours.
            var timeStamp = performance.now();
            if (timeStamp - mouseUpTimeStamp < 400 && mouseUpType !== event.type) {
                return;
            }
            mouseUpTimeStamp = timeStamp;
            mouseUpType = event.type;
    
            if (this.navigating) {
                return;
            }
    
            if (this.editFrame.isActive()) {
                this.editFrame.onMouseUp(event);
                return;
            }
    
            if (!this.ignoreNextMouseUp) {
                this.editMode.onMouseUp(event);
            }
        };
    
        proto.onMouseDoubleClick = function (event) {
    
            if (this.navigating) {
                return;
            }
    
            if (this.editFrame.isActive()) {
                return;
            }
    
            this.editMode.onMouseDoubleClick(event);
        };
    
        proto.onUserCancel = function () {
    
            if (this.editMode.creating) {
                this.editMode.creationCancel();
            } else {
                this.editMode.unselect();
            }
        };
    
        /**
         *
         * @param event
         */
        proto.onMarkupSelected = function (event) {
    
            this.selectMarkup(event.markup);
            this.fireEvent(event);
        };
    
        proto.onMarkupEnterEdition = function (event) {
    
        };
    
        proto.onMarkupCancelEdition = function (event) {
    
            this.onUserCancel();
        };
    
        proto.onMarkupDeleteEdition = function (event) {
    
            this.removeMarkup(event.markup);
            this.editMode.deleteMarkup();
        };
    
        theExtensionManager.registerExtension('Autodesk.Viewing.MarkupsCore', MarkupsCore);
});