define([
    './EditAction',
    './CreatePolyline'
], function(EditAction, CreatePolyline) {
    'use strict';
    /**
     *
     * @param editor
     * @param polyline
     * @constructor
     */
    function DeletePolyline(editor, polyline) {
        
                EditAction.call(this, editor, 'DELETE-POLYLINE', polyline.id);
                this.createPolyline = new CreatePolyline(
                    editor,
                    polyline.id,
                    polyline.position,
                    polyline.size,
                    polyline.rotation,
                    polyline.locations,
                    polyline.getStyle());
            }
        
            DeletePolyline.prototype = Object.create(EditAction.prototype);
            DeletePolyline.prototype.constructor = DeletePolyline;
        
            var proto = DeletePolyline.prototype;
        
            proto.redo = function () {
        
                this.createPolyline.undo();
            };
        
            proto.undo = function () {
        
                this.createPolyline.redo();
            };

            return DeletePolyline;
});