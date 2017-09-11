define([
    './EditAction',
    './Utils',
    './MarkupCloud'
], function(EditAction, Utils, MarkupCloud) {
    'use strict';
    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param style
     * @constructor
     */
    function CreateCloud(editor, id, position, size, rotation, style) {
        
                EditAction.call(this, editor, 'CREATE-CLOUD', id);
        
                this.selectOnExecution = false;
                this.position = { x: position.x, y: position.y };
                this.size = { x: size.x, y: size.y };
                this.rotation = rotation;
                this.style = Utils.cloneStyle(style);
            }
        
            CreateCloud.prototype = Object.create(EditAction.prototype);
            CreateCloud.prototype.constructor = CreateCloud;
        
            var proto = CreateCloud.prototype;
        
            proto.redo = function () {
        
                var editor = this.editor;
                var cloud = new MarkupCloud(this.targetId, editor);
        
                editor.addMarkup(cloud);
        
                cloud.set(this.position, this.size);
                cloud.setRotation(this.rotation);
                cloud.setStyle(this.style);
            };
        
            proto.undo = function () {
        
                var markup = this.editor.getMarkup(this.targetId);
                markup && this.editor.removeMarkup(markup);
            };

            return CreateCloud;
});