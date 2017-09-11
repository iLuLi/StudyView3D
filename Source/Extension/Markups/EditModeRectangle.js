define(['./EditMode', './Constants', './DeleteRectangle', './SetRectangle'], function(EditMode, Constants, DeleteRectangle, SetRectangle) {;
    'use strict'
    /**
     *
     * @param editor
     * @constructor
     */
    function EditModeRectangle(editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
                EditMode.call(this, editor, Constants.MARKUP_TYPE_RECTANGLE, styleAttributes);
            }
        
            EditModeRectangle.prototype = Object.create(EditMode.prototype);
            EditModeRectangle.prototype.constructor = EditModeRectangle;
        
            var proto = EditModeRectangle.prototype;
        
            proto.deleteMarkup = function (markup, cantUndo) {
        
                markup = markup || this.selectedMarkup;
                if (markup && markup.type == this.type) {
                    var deleteRectangle = new DeleteRectangle(this.editor, markup);
                    deleteRectangle.addToHistory = !cantUndo;
                    deleteRectangle.execute();
                    return true;
                }
                return false;
            };
        
            /**
             * Sets multiple text properties at once
             * @param {Object} style
             */
            proto.setStyle = function (style) {
        
                EditMode.prototype.setStyle.call(this, style);
        
                var rectangle = this.selectedMarkup;
                if (!rectangle) {
                    return;
                }
        
                // TODO: Change to use SetStyle //
                var setRectangle = new SetRectangle(
                    this.editor,
                    rectangle,
                    rectangle.position,
                    rectangle.size);
        
                setRectangle.execute();
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
                var position = editor.clientToMarkups((initialX + final.x) / 2, (initialY + final.y) / 2);
                var size = this.size = editor.sizeFromClientToMarkups((final.x - initialX), (final.y - initialY));
        
                var setRectangle = new SetRectangle(
                    editor,
                    selectedMarkup,
                    position,
                    size);
        
                setRectangle.execute();
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
        
                // Create rectangle.
                editor.beginActionGroup();
        
                var markupId = editor.getId();
                var create = new CreateRectangle(
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

            return EditModeRectangle;
});