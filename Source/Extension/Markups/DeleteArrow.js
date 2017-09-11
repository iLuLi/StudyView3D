define([
    './EditAction',
    './CreateArrow'
], function(EditAction, CreateArrow) {
    'use strict';
    /**
     *
     * @param editor
     * @param arrow
     * @constructor
     */
    function DeleteArrow(editor, arrow) {
        
                EditAction.call(this, editor, 'DELETE-ARROW', arrow.id);
                this.createArrow = new CreateArrow(
                    editor,
                    arrow.id,
                    arrow.head,
                    arrow.tail,
                    arrow.getStyle());
            }
        
            DeleteArrow.prototype = Object.create(EditAction.prototype);
            DeleteArrow.prototype.constructor = DeleteArrow;
        
            var proto = DeleteArrow.prototype;
        
            proto.redo = function () {
        
                this.createArrow.undo();
            };
        
            proto.undo = function () {
        
                this.createArrow.redo();
            };

            return DeleteArrow;
});