define([
    './EditMode',
    './Constants',
    './DeleteFreehand',
    './SetFreehand',
    './CreateFreehand'
], function(EditMode, Constants, DeleteFreehand, SetFreehand, CreateFreehand) {
    'use strict';
    /**
     *
     * @param editor
     * @constructor
     */
    function EditModeFreehand(editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity'];
                EditMode.call(this, editor, Constants.MARKUP_TYPE_FREEHAND, styleAttributes);
                this.style['stroke-opacity'] = 0.75;
            }
        
            EditModeFreehand.prototype = Object.create(EditMode.prototype);
            EditModeFreehand.prototype.constructor = EditModeFreehand;
        
            var proto = EditModeFreehand.prototype;
        
            proto.deleteMarkup = function (markup, cantUndo) {
        
                markup = markup || this.selectedMarkup;
                if (markup && markup.type == this.type) {
                    var deleteFreehand = new DeleteFreehand(this.editor, markup);
                    deleteFreehand.addToHistory = !cantUndo;
                    deleteFreehand.execute();
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
                var mousePosition = editor.getMousePosition();
                var movements = this.movements;
        
                var location = editor.clientToMarkups(mousePosition.x, mousePosition.y);
                movements.push(location);
        
                // determine the position of the top-left and bottom-right points
                var minFn = function (collection, key) {
                    var targets = collection.map(function (item) {
                        return item[key];
                    });
                    return Math.min.apply(null, targets);
                };
        
                var maxFn = function (collection, key) {
                    var targets = collection.map(function (item) {
                        return item[key];
                    });
                    return Math.max.apply(null, targets);
                };
        
                var l = minFn(movements, 'x');
                var t = minFn(movements, 'y');
                var r = maxFn(movements, 'x');
                var b = maxFn(movements, 'y');
        
                var width = r - l;  // Already in markup coords space
                var height = b - t; // Already in markup coords space
        
                var position = {
                    x: l + width * 0.5,
                    y: t + height * 0.5
                };
                var size = this.size = { x: width, y: height };
        
                // Adjust points to relate from the shape's center
                var locations = movements.map(function (point) {
                    return {
                        x: point.x - position.x,
                        y: point.y - position.y
                    };
                });
        
                var setFreehand = new SetFreehand(
                    editor,
                    selectedMarkup,
                    position,
                    size,
                    locations);
        
                setFreehand.execute();
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
        
                //set the starting point
                var position = editor.clientToMarkups(this.initialX, this.initialY);
                this.movements = [position];
        
                var size = this.size = editor.sizeFromClientToMarkups(1, 1);
        
                // Create arrow.
                editor.beginActionGroup();
        
                var markupId = editor.getId();
                var create = new CreateFreehand(
                    editor,
                    markupId,
                    position,
                    size,
                    0,
                    [{ x: 0, y: 0 }],
                    this.style);
        
                create.execute();
        
                this.selectedMarkup = editor.getMarkup(markupId);
                this.creationBegin();
            };

            return EditModeFreehand;
});