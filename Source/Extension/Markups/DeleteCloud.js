define([
    './EditAction',
    './CreateCloud'
], function(EditAction, CreateCloud) {
    'use strict';
    /**
     *
     * @param editor
     * @param cloud
     * @constructor
     */
    function DeleteCloud(editor, cloud) {
        
                EditAction.call(this, editor, 'DELETE-CLOUD', cloud.id);
                this.createCloud = new CreateCloud(
                    editor,
                    cloud.id,
                    cloud.position,
                    cloud.size,
                    cloud.rotation,
                    cloud.getStyle());
            }
        
            DeleteCloud.prototype = Object.create(EditAction.prototype);
            DeleteCloud.prototype.constructor = DeleteCloud;
        
            var proto = DeleteCloud.prototype;
        
            proto.redo = function () {
        
                this.createCloud.undo();
            };
        
            proto.undo = function () {
        
                this.createCloud.redo();
            };

            return DeleteCloud;
});