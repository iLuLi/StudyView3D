define([
    './Markup',
    './Constants',
    './Utils',
    './EditModeCircle'
], function(Markup, Constants, Utils, EditModeCircle) {
    'use strict';
    /**
     *
     * @param id
     * @param editor
     * @constructor
     */
    function MarkupCircle(id, editor) {
        
                var styleAttributes = ['stroke-width', 'stroke-color', 'stroke-opacity', 'fill-color', 'fill-opacity'];
                Markup.call(this, id, editor, styleAttributes);
        
                this.type = Constants.MARKUP_TYPE_CIRCLE;
                this.shape = Utils.createMarkupPathSvg();
        
                this.bindDomEvents();
            }
        
            MarkupCircle.prototype = Object.create(Markup.prototype);
            MarkupCircle.prototype.constructor = MarkupCircle;
        
            var proto = MarkupCircle.prototype;
        
            proto.getEditMode = function () {
        
                return new EditModeCircle(this.editor);
            };
        
            proto.set = function (position, size) {
        
                this.setSize(position, size.x, size.y);
            };
        
            /**
             * Applies data values into DOM element style/attribute(s)
             *
             */
            proto.updateStyle = function () {
        
                var style = this.style;
                var shape = this.shape;
                var path = this.getPath().join(' ');
        
                var strokeWidth = this.style['stroke-width'];
                var strokeColor = this.highlighted ? this.highlightColor : Utils.composeRGBAString(style['stroke-color'], style['stroke-opacity']);
                var fillColor = Utils.composeRGBAString(style['fill-color'], style['fill-opacity']);
                var transform = this.getTransform();
        
                Utils.setAttributeToMarkupSvg(shape, 'd', path);
                Utils.setAttributeToMarkupSvg(shape, 'stroke-width', strokeWidth);
                Utils.setAttributeToMarkupSvg(shape, 'stroke', strokeColor);
                Utils.setAttributeToMarkupSvg(shape, 'fill', fillColor);
                Utils.setAttributeToMarkupSvg(shape, 'transform', transform);
                Utils.updateMarkupPathSvgHitarea(shape, this.editor);
            };
        
            proto.setMetadata = function () {
        
                var metadata = Utils.cloneStyle(this.style);
        
                metadata.type = this.type;
                metadata.position = [this.position.x, this.position.y].join(" ");
                metadata.size = [this.size.x, this.size.y].join(" ");
                metadata.rotation = String(this.rotation);
        
                return Utils.addMarkupMetadata(this.shape, metadata);
            };
        
            proto.getPath = function () {
        
                var size = this.size;
                if (size.x === 1 || size.y === 1) {
                    return [''];
                }
        
                var strokeWidth = this.style['stroke-width'];
        
                var w = size.x;
                var h = size.y;
        
                var ellipseW = w - strokeWidth;
                var ellipseH = h - strokeWidth;
        
                var halfStrokeWidth = strokeWidth * 0.5;
        
                var ellipseX = halfStrokeWidth - w * 0.5;
                var ellipseY = 0;
        
                var path = [];
                Utils.createEllipsePath(ellipseX, ellipseY, ellipseW, ellipseH, false, path);
        
                return path;
            };

            return MarkupCircle;
});