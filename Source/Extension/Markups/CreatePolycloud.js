define([
    './EditAction',
    './Utils',
    './MarkupPolycloud'
], function(EditAction, Utils, MarkupPolycloud) {
    'use strict';
    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param rotation
     * @param locations
     * @param style
     * @constructor
     */
    function CreatePolycloud(editor, id, position, size, rotation, locations, style) {
        
                EditAction.call(this, editor, 'CREATE-POLYCLOUD', id);
        
                this.selectOnExecution = false;
                this.position = position;
                this.size = size;
                this.rotation = rotation;
                this.movements = locations.concat();
                this.style = Utils.cloneStyle(style);
            }
        
            CreatePolycloud.prototype = Object.create(EditAction.prototype);
            CreatePolycloud.prototype.constructor = CreatePolycloud;
        
            var proto = CreatePolycloud.prototype;
        
            proto.redo = function () {
        
                var editor = this.editor;
                var polyline = new MarkupPolycloud(this.targetId, editor);
        
                editor.addMarkup(polyline);
        
                polyline.set(this.position, this.size, this.movements);
                polyline.setRotation(this.rotation);
                polyline.setStyle(this.style);
            };
        
            proto.undo = function () {
        
                var markup = this.editor.getMarkup(this.targetId);
                markup && this.editor.removeMarkup(markup);
            };

            return CreatePolycloud;
});