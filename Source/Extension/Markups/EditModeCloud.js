define([
    './EditMode',
    './Constants',
    './DeleteCloud',
    './SetCloud',
    './CreateCloud'
], function(EditMode, Constants, DeleteCloud, SetCloud, CreateCloud) {
    'use strict';
    /**
     *
     * @param editor
     * @constructor
     */
    function EditModeCloud(editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
                EditMode.call(this, editor, Constants.MARKUP_TYPE_CLOUD, styleAttributes);
            }
        
            EditModeCloud.prototype = Object.create(EditMode.prototype);
            EditModeCloud.prototype.constructor = EditModeCloud;
        
            var proto = EditModeCloud.prototype;
        
            proto.deleteMarkup = function (markup, cantUndo) {
        
                markup = markup || this.selectedMarkup;
                if (markup && markup.type == this.type) {
                    var deleteCloud = new DeleteCloud(this.editor, markup);
                    deleteCloud.addToHistory = !cantUndo;
                    deleteCloud.execute();
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
                var position = editor.clientToMarkups((initialX + final.x) / 2, (initialY + final.y) / 2);
                var size = this.size = editor.sizeFromClientToMarkups((final.x - initialX), (final.y - initialY));
        
                var setCloud = new SetCloud(
                    editor,
                    selectedMarkup,
                    position,
                    size);
        
                setCloud.execute();
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
        
                // Create Cloud.
                editor.beginActionGroup();
        
                var markupId = editor.getId();
                var create = new CreateCloud(
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

            return EditModeCloud;
});