define([
    './EditMode',
    './Constants',
    './DeleteArrow',
    './SetArrow',
    './CreateArrow'
], function(EditMode, Constants, DeleteArrow, SetArrow, CreateArrow) {
    'use strict';
    /**
     *
     * @param editor
     * @constructor
     */
    function EditModeArrow(editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
                EditMode.call(this, editor, Constants.MARKUP_TYPE_ARROW, styleAttributes);
            }
        
            EditModeArrow.prototype = Object.create(EditMode.prototype);
            EditModeArrow.prototype.constructor = EditModeArrow;
        
        
            var proto = EditModeArrow.prototype;
        
            proto.deleteMarkup = function (markup, cantUndo) {
        
                markup = markup || this.selectedMarkup;
                if (markup && markup.type == this.type) {
                    var deleteArrow = new DeleteArrow(this.editor, markup);
                    deleteArrow.addToHistory = !cantUndo;
                    deleteArrow.execute();
                    return true;
                }
                return false;
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
        
                this.size.x = 0;
                this.size.y = 0;
        
                // Calculate head and tail.
                var arrowMinSize = this.style['stroke-width'] * 3.5;
                var arrowMinSizeClient = editor.sizeFromMarkupsToClient(arrowMinSize, 0).x;
        
                var head = { x: this.initialX, y: this.initialY };
                var tail = {
                    x: Math.round(head.x + Math.cos(Math.PI * 0.25) * arrowMinSizeClient),
                    y: Math.round(head.y + Math.sin(-Math.PI * 0.25) * arrowMinSizeClient)
                };
                // Constrain head and tail inside working area.
                var constrain = function (head, tail, size, bounds) {
        
                    if (this.isInsideBounds(tail.x, tail.y, bounds)) {
                        return;
                    }
        
                    tail.y = Math.round(head.y + Math.sin(Math.PI * 0.25) * size);
                    if (this.isInsideBounds(tail.x, tail.y, bounds)) {
                        return;
                    }
        
                    tail.x = Math.round(head.x + Math.cos(-Math.PI * 0.25) * size);
                    if (this.isInsideBounds(tail.x, tail.y, bounds)) {
                        return;
                    }
        
                    tail.y = Math.round(head.y + Math.sin(-Math.PI * 0.25) * size);
        
                }.bind(this);
        
                constrain(head, tail, arrowMinSizeClient, editor.getBounds());
        
                // Create arrow.
                editor.beginActionGroup();
        
                head = editor.positionFromClientToMarkups(head.x, head.y);
                tail = editor.positionFromClientToMarkups(tail.x, tail.y);
        
                var arrowVector = new THREE.Vector2(tail.x - head.x, tail.y - head.y);
                if (arrowVector.lengthSq() < arrowMinSize * arrowMinSize) {
        
                    arrowVector = arrowVector.normalize().multiplyScalar(arrowMinSize);
                    tail.x = head.x + arrowVector.x;
                    tail.y = head.y + arrowVector.y;
                }
        
                var arrowId = editor.getId();
                var create = new CreateArrow(editor, arrowId, head, tail, this.style);
                create.execute();
        
                this.selectedMarkup = editor.getMarkup(arrowId);
                this.creationBegin();
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
                var final = this.getFinalMouseDraggingPosition();
                var initialX = this.initialX;
                var initialY = this.initialY;
        
                var head = editor.positionFromClientToMarkups(initialX, initialY);
                var tail = editor.positionFromClientToMarkups(final.x, final.y);
        
                var arrowVector = new THREE.Vector2(tail.x - head.x, tail.y - head.y);
                var arrowMinSize = selectedMarkup.style['stroke-width'] * 3.5;
        
                if (arrowVector.lengthSq() < arrowMinSize * arrowMinSize) {
        
                    arrowVector = arrowVector.normalize().multiplyScalar(arrowMinSize);
                    tail.x = head.x + arrowVector.x;
                    tail.y = head.y + arrowVector.y;
                }
        
                this.size = editor.sizeFromClientToMarkups((final.x - initialX), (final.y - initialY));
        
                var setArrow = new SetArrow(editor, selectedMarkup, head, tail);
                setArrow.execute();
            };

            return EditModeArrow;
        
});