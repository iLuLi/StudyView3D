define([
    './EditAction',
    './CreatePolyline'
], function(EditAction, CreatePolyline) {
    'use strict';
    /**
     *
     * @param editor
     * @param polycloud
     * @constructor
     */
    function DeletePolycloud(editor, polycloud) {
        
                EditAction.call(this, editor, 'DELETE-POLYCLOUD', polycloud.id);
                this.createPolycloud = new CreatePolyline(
                    editor,
                    polycloud.id,
                    polycloud.position,
                    polycloud.size,
                    polycloud.rotation,
                    polycloud.locations,
                    polycloud.getStyle());
            }
        
            DeletePolycloud.prototype = Object.create(EditAction.prototype);
            DeletePolycloud.prototype.constructor = DeletePolycloud;
        
            var proto = DeletePolycloud.prototype;
        
            proto.redo = function () {
        
                this.createPolycloud.undo();
            };
        
            proto.undo = function () {
        
                this.createPolycloud.redo();
            };

            return DeletePolycloud;
});