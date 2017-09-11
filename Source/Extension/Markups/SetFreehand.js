define([
    './EditAction',
], function(EditAction) {
    'use strict';
    /**
     *
     * @param editor
     * @param freehand
     * @param position
     * @param size
     * @param locations
     * @constructor
     */
    function SetFreehand(editor, freehand, position, size, locations) {
        
                EditAction.call(this, editor, 'SET-FREEHAND', freehand.id);
        
                this.position = position;
                this.size = size;
                this.locations = locations.concat();
        
                // No need to save old data
            }
        
            SetFreehand.prototype = Object.create(EditAction.prototype);
            SetFreehand.prototype.constructor = SetFreehand;
        
            var proto = SetFreehand.prototype;
        
            proto.redo = function () {
        
                var freehand = this.editor.getMarkup(this.targetId);
                if (!freehand) {
                    return;
                }
        
                freehand.set(this.position, this.size, this.locations);
            };
        
            proto.undo = function () {
                // No need for undo.
            };
        
            proto.merge = function (action) {
        
                if (this.targetId === action.targetId &&
                    this.type === action.type) {
        
                    this.locations = action.locations.concat();
                    this.position = action.position;
                    this.size = action.size;
                    return true;
                }
                return false;
            };
        
            /**
             * @returns {boolean}
             */
            proto.isIdentity = function () {
        
                return false; // No need to optimize, always false.
            };

            return SetFreehand;
});