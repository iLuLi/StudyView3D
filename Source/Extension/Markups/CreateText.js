define([
    './EditAction',
    './MarkupText',
    './Utils'
], function (EditAction, MarkupText, Utils) {
    'use strict';
    /**
     *
     * @param editor
     * @param id
     * @param position
     * @param size
     * @param text
     * @param style
     * @constructor
     */
    function CreateText(editor, id, position, size, text, style) {

        EditAction.call(this, editor, 'CREATE-TEXT', id);

        this.text = text;
        this.position = { x: position.x, y: position.y };
        this.size = { x: size.x, y: size.y };
        this.style = Utils.cloneStyle(style);
    }

    CreateText.prototype = Object.create(EditAction.prototype);
    CreateText.prototype.constructor = CreateText;

    var proto = CreateText.prototype;

    proto.redo = function () {

        var editor = this.editor;
        var position = this.position;
        var size = this.size;

        var text = new MarkupText(this.targetId, editor, size);

        editor.addMarkup(text);

        text.setSize(position, size.x, size.y);
        text.setText(this.text);
        text.setStyle(this.style);
    };

    proto.undo = function () {

        var markup = this.editor.getMarkup(this.targetId);
        if (markup) {
            this.editor.removeMarkup(markup);
            markup.destroy();
        }
    };

    return CreateText;
});