define([
    './EditMode',
    './Constants',
    './DeleteCircle',
    './SetCircle',
    './CreateCircle'
], function(EditMode, Constants, DeleteCircle, SetCircle, CreateCircle) {
    'use strict';
    /**
     * @class
     * Implements a Circle [EditMode]{@link Autodesk.Viewing.Extensions.Markups.Core.EditMode}.
     * Included in documentation as an example of how to create
     * an EditMode for a specific markup type. Developers are encourage to look into this class's source code and copy
     * as much code as they need. Find link to source code below.
     *
     * @tutorial feature_markup
     * @constructor
     * @memberof Autodesk.Viewing.Extensions.Markups.Core
     * @extends Autodesk.Viewing.Extensions.Markups.Core.EditMode
     *
     * @param {Autodesk.Viewing.Extensions.Markups.Core.MarkupsCore} editor
     */
    function EditModeCircle(editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
                EditMode.call(this, editor, Constants.MARKUP_TYPE_CIRCLE, styleAttributes);
            }
        
            EditModeCircle.prototype = Object.create(EditMode.prototype);
            EditModeCircle.prototype.constructor = EditModeCircle;
        
            var proto = EditModeCircle.prototype;
        
            proto.deleteMarkup = function (markup, cantUndo) {
        
                markup = markup || this.selectedMarkup;
                if (markup && markup.type == this.type) {
                    var deleteCircle = new DeleteCircle(this.editor, markup);
                    deleteCircle.addToHistory = !cantUndo;
                    deleteCircle.execute();
                    return true;
                }
                return false;
            };
        
            /**
             * Handler to mouse move events, used to create markups.
             * @param {MouseEvent} event Mouse event.
             * @private
             */
            proto.onMouseMove = function (event) {
        
                EditMode.prototype.onMouseMove.call(this, event);
        
                var selectedMarkup = this.selectedMarkup;
                if (!selectedMarkup || !this.creating) {
                    return;
                }
        
                var editor = this.editor;
                var initialX = this.initialX;
                var initialY = this.initialY;
                var final = this.getFinalMouseDraggingPosition();
        
                var sizeX = Math.abs(initialX - final.x);
                var sizeY = Math.abs(initialY - final.y);
        
                var position = editor.clientToMarkups((initialX + final.x) * 0.5, (initialY + final.y) * 0.5);
                var size = this.size = editor.sizeFromClientToMarkups(sizeX, sizeY);
        
                var setCircle = new SetCircle(
                    editor,
                    selectedMarkup,
                    position,
                    size);
        
                setCircle.execute();
            };
        
            /**
             * Handler to mouse down events, used to start markups creation.
             * @private
             */
            proto.onMouseDown = function () {
        
                EditMode.prototype.onMouseDown.call(this);
        
                if (this.selectedMarkup) {
                    return;
                }
        
                var editor = this.editor;
                var mousePosition = editor.getMousePosition();
        
                this.initialX = mousePosition.x;
                this.initialY = mousePosition.y;
        
                // Calculate center and size.
                var position = editor.clientToMarkups(this.initialX, this.initialY);
                var size = this.size = editor.sizeFromClientToMarkups(1, 1);
        
                // Create circle.
                editor.beginActionGroup();
        
                var markupId = editor.getId();
                var create = new CreateCircle(
                    editor,
                    markupId,
                    position,
                    size,
                    0,
                    this.style);
                create.execute();
        
                this.selectedMarkup = editor.getMarkup(markupId);
                this.creationBegin();
            };
        
            EditModeCircle = EditModeCircle;
});