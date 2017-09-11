define([
    './EditAction',
    './CreateFreehand'
], function(EditAction, CreateFreehand) {
    'use strict';
    /**
     *
     * @param editor
     * @param freehand
     * @constructor
     */
    function DeleteFreehand(editor, freehand) {
        
                EditAction.call(this, editor, 'DELETE-FREEHAND', freehand.id);
                this.createFreehand = new CreateFreehand(
                    editor,
                    freehand.id,
                    freehand.position,
                    freehand.size,
                    freehand.rotation,
                    freehand.locations,
                    freehand.getStyle());
            }
        
            DeleteFreehand.prototype = Object.create(EditAction.prototype);
            DeleteFreehand.prototype.constructor = DeleteFreehand;
        
            var proto = DeleteFreehand.prototype;
        
            proto.redo = function () {
        
                this.createFreehand.undo();
            };
        
            proto.undo = function () {
        
                this.createFreehand.redo();
            };

            return DeleteFreehand;
});