define([
    './EditAction',
    './Utils',
    './MarkupArrow'
], function(EditAction, Utils, MarkupArrow) {
    'use strict';
    /**
     * @constructor
     */
    function CreateArrow(editor, id, head, tail, style) {
        
                EditAction.call(this, editor, 'CREATE-ARROW', id);
        
                this.selectOnExecution = false;
                this.tail = tail;
                this.head = head;
                this.style = Utils.cloneStyle(style);
            }
        
            CreateArrow.prototype = Object.create(EditAction.prototype);
            CreateArrow.prototype.constructor = CreateArrow;
        
            var proto = CreateArrow.prototype;
        
            proto.redo = function () {
        
                var editor = this.editor;
                var arrow = new MarkupArrow(this.targetId, editor);
        
                editor.addMarkup(arrow);
        
                arrow.set(this.head.x, this.head.y, this.tail.x, this.tail.y);
                arrow.setStyle(this.style);
            };
        
            proto.undo = function () {
        
                var markup = this.editor.getMarkup(this.targetId);
                markup && this.editor.removeMarkup(markup);
            };

            return CreateArrow;
});