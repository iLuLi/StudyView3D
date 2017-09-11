define([
    './Utils',
    './Markup',
    './Constants',
    './EditModeText'
], function(Utils, Markup, Constants, EditModeText) {
    'use strict';
    /**
     * Arrow Markup.
     * @constructor
     */
    function MarkupText(id, editor, size) {
        
                var styleAttributes = [
                    'font-size',
                    'stroke-color',
                    'stroke-opacity',
                    'fill-color',
                    'fill-opacity',
                    'font-family',
                    'font-style',
                    'font-weight'
                ];
        
                Markup.call(this, id, editor, styleAttributes);
        
                this.type = Constants.MARKUP_TYPE_TEXT;
                this.shape = Utils.createMarkupTextSvg();
                this.constraintRotation = true;
                this.size.x = size.x;
                this.size.y = size.y;
                this.currentText = "";
                this.currentTextLines = [""];
                this.textDirty = true;
                this.textSize = { x: 0, y: 0 };
        
                // Note: We could have this property be a style property.
                // However, there is no need for this property to be exposed to the user for alteration
                // This value is a percentage of the font size used to offset vertically 2 text lines
                // of the same paragraph.
                // Notice that this value is used by EditorTextInput.js
                this.lineHeight = 130;
        
                this.bindDomEvents();
            }
        
            MarkupText.prototype = Object.create(Markup.prototype);
            MarkupText.prototype.constructor = MarkupText;
        
            var proto = MarkupText.prototype;
        
            proto.getEditMode = function () {
        
                return new EditModeText(this.editor);
            };
        
            /**
             *
             * @param {String} position
             * @param {String} size
             * @param {String} textString
             * @param {Array} textLines
             */
            proto.set = function (position, size, textString, textLines) {
        
                this.position.x = position.x;
                this.position.y = position.y;
                this.size.x = size.x;
                this.size.y = size.y;
        
                this.setText(textString, textLines);
            };
        
            proto.setSize = function (position, width, height) {
        
                this.position.x = position.x;
                this.position.y = position.y;
                this.size.x = width;
                this.size.y = height;
        
                this.updateStyle();
            };
        
            proto.setStyle = function (style) {
        
                Utils.copyStyle(style, this.style);
                this.updateStyle();
            };
        
            /**
             *
             * @param {String} text
             */
            proto.setText = function (text) {
        
                this.currentText = text;
                this.updateStyle();
            };
        
            /**
             * Returns the raw string value
             * @returns {String}
             */
            proto.getText = function () {
        
                return this.currentText;
            };
        
            /**
             * Returns a shallow copy of the text lines used for rendering SVG text
             * @returns {Array.<String>}
             */
            proto.getTextLines = function () {
        
                return this.currentTextLines.concat();
            };
        
            /**
             * Applies data values into DOM element style/attribute(s)
             *
             */
            proto.updateStyle = function () {
        
                function applyState() {
        
                    var style = this.style;
                    var shape = this.shape;
                    var fontSize = this.style['font-size'];
                    var fontFamily = this.style['font-family'];
                    var fontWeight = this.style['font-weight'];
                    var fontStyle = this.style['font-style'];
                    var strokeColor = this.highlighted ? this.highlightColor : Utils.composeRGBAString(style['stroke-color'], style['stroke-opacity']);
                    var fillColor = Utils.composeRGBAString(style['fill-color'], style['fill-opacity']);
        
                    this.rebuildTextSvg();
        
                    Utils.setAttributeToMarkupSvg(shape, 'font-family', fontFamily);
                    Utils.setAttributeToMarkupSvg(shape, 'font-size', fontSize);
                    Utils.setAttributeToMarkupSvg(shape, 'fill', strokeColor);
                    Utils.setAttributeToMarkupSvg(shape, 'font-weight', fontWeight);
                    Utils.setAttributeToMarkupSvg(shape, 'font-style', fontStyle);
        
                    var editor = this.editor;
                    var transform = this.getTransform();
                    var textTransform = this.getTextTransform();
                    var textSize = this.textSize;
        
                    Utils.setMarkupTextSvgTransform(shape, transform, textTransform);
                    Utils.updateMarkupTextSvgBackground(shape, textSize.x, textSize.y, fillColor);
                    Utils.updateMarkupTextSvgClipper(shape, textSize.x, textSize.y);
                    Utils.updateMarkupTextSvgHitarea(shape, textSize.x, textSize.y, editor);
        
                    this.applyingStyle = false;
                }
        
                this.applyingStyle = this.applyingStyle || false;
                if (!this.applyingStyle) {
                    this.applyingStyle = true;
                    requestAnimationFrame(applyState.bind(this));
                }
            };
        
            /**
             * Re-creates SVG tags that render SVG text.
             * Each line is placed around tspan tags which are vertically offset to each other.
             */
            proto.rebuildTextSvg = function () {
        
                // TODO: Remove the need to get text values from an object in edit mode, should be a function.
                var editMode = this.editor.editMode;
                if (editMode && editMode.type === this.type) {
                    var style = Utils.cloneStyle(editMode.textInputHelper.style);
                    var text = editMode.textInputHelper.textArea.value;
                    this.currentTextLines = editMode.textInputHelper.getTextValuesForMarkup(this).lines;
                    if (editMode.selectedMarkup !== this) {
                        editMode.textInputHelper.textArea.value = text;
                        editMode.textInputHelper.setStyle(style);
                    }
                }
        
                var markup = Utils.createSvgElement('text');
                markup.setAttribute('id', 'markup');
                markup.setAttribute('alignment-baseline', 'middle');
        
                this.shape.childNodes[0].removeChild(this.shape.markup);
                this.shape.childNodes[0].appendChild(markup);
                this.shape.markup = markup;
        
                // For each line, create a tspan, add as child and offset it vertically.
                var dx = 0;
                var dy = 0;
                var yOffset = this.getLineHeight();
        
                this.currentTextLines.forEach(function (line) {
        
                    var tspan = Utils.createSvgElement('tspan');
        
                    tspan.setAttribute('x', dx);
                    tspan.setAttribute('y', dy);
                    tspan.textContent = line;
        
                    markup.appendChild(tspan);
                    dy += yOffset;
                }.bind(this));
        
                var polygon = this.generateBoundingPolygon();
                var textSize = this.editor.sizeFromClientToMarkups(
                    polygon.xVertices[1] - polygon.xVertices[0],
                    polygon.yVertices[2] - polygon.yVertices[0]);
        
                this.textSize.x = Math.min(textSize.x, this.size.x);
                this.textSize.y = Math.min(textSize.y, this.size.y);
            };
        
            /**
             *
             * @returns {{vertexCount: number, xVertices: Float32Array, yVertices: Float32Array}}
             */
            proto.generateBoundingPolygon = function () {
        
                function getTextSize(lines, style, editor) {
        
                    var size = { w: 0, h: 0 };
        
                    var lines = Utils.measureTextLines(lines, style, editor);
                    var linesCount = lines.length;
        
                    for (var i = 0; i < linesCount; ++i) {
        
                        var line = lines[i];
        
                        size.w = Math.max(size.w, line.width);
                        size.h = size.h + line.height;
                    }
        
                    if (size.h !== 0) {
                        size.h += editor.sizeFromMarkupsToClient(0, style['font-size'] * 0.25).y;
                    }
        
                    return size;
                }
        
                var position = this.getClientPosition();
                var size = this.getClientSize();
                var textSize = getTextSize(this.currentTextLines, this.style, this.editor);
        
                var w = Math.min(size.x, textSize.w);
                var h = Math.min(size.y, textSize.h);
        
                var lt = new THREE.Vector2(-size.x * 0.5, -size.y * 0.5).add(position);
                var rt = new THREE.Vector2(lt.x + w, lt.y);
                var rb = new THREE.Vector2(rt.x, rt.y + h);
                var lb = new THREE.Vector2(lt.x, rb.y);
        
                return { // packed for fast access in test algorithm.
                    vertexCount: 4,
                    xVertices: new Float32Array([lt.x, rt.x, rb.x, lb.x]),
                    yVertices: new Float32Array([lt.y, rt.y, rb.y, lb.y])
                };
            };
        
            proto.setMetadata = function () {
        
                var metadata = Utils.cloneStyle(this.style);
        
                metadata.type = this.type;
                metadata.position = [this.position.x, this.position.y].join(" ");
                metadata.size = [this.size.x, this.size.y].join(" ");
                metadata.text = String(this.currentText);
        
                return Utils.addMarkupMetadata(this.shape, metadata);
            };
        
            /**
             * Helper method that returns the font size in client space coords.
             * @returns {Number}
             */
            proto.getClientFontSize = function () {
        
                return this.editor.sizeFromMarkupsToClient(0, this.style['font-size']).y;
            };
        
            proto.getLineHeight = function () {
        
                return this.style['font-size'];
            };
        
            proto.renderToCanvas = function (ctx) {
        
                /**
                 * Renders the lines of text to the canvas.
                 * This method does not attempt to figure out how to wrap text. Instead, it expects
                 * a set of lines that are already adjusted to fit in the given space.
                 * All this does it renders them in the correct vertical position
                 *
                 * @param {CanvasRenderingContext2D} ctx - the canvas context to draw on
                 * @param {String[]} lines - the lines of text to render already adjusted to wrap properly
                 * @param {Number} lineHeight - the height of each line
                 * @param {Number} maxHeight - maximum height the text will render to
                 */
                function renderLinesOfText(ctx, lines, lineHeight, maxHeight) {
        
                    var y = 0;//only the vertical position changes
                    lines.forEach(function (line) {
                        //check if we're over the max height allowed
                        //if so, just end
                        if ((y + lineHeight) > maxHeight) {
                            return;
                        }
                        ctx.fillText(line, 0, y);
                        y += lineHeight;
                    });
                }
        
                var fontFamily = this.style['font-family'];
                var fontStyle = this.style['font-style'];
                var fontWeight = this.style['font-weight'];
                var strokeColor = this.style['stroke-color'];
                var fontOpacity = this.style['stroke-opacity'];
                var fontSize = this.getClientFontSize();
        
                //var rotation = this.getRotation(); TODO: Revisit rotation when it becomes available
                var center = this.editor.positionFromMarkupsToClient(this.position.x, this.position.y);
                var clientSize = this.editor.sizeFromMarkupsToClient(this.size.x, this.size.y);
                var clientTextSize = this.editor.sizeFromMarkupsToClient(this.textSize.x, this.textSize.y);
                var clientLineHeight = this.editor.sizeFromMarkupsToClient(0, this.getLineHeight()).y;
        
                // Background rect
                ctx.save();
                {
                    var fillColor = this.style['fill-color'];
                    var fillOpacity = this.style['fill-opacity'];
        
                    ctx.fillStyle = Utils.composeRGBAString(fillColor, fillOpacity);
                    ctx.translate(center.x, center.y);
                    fillOpacity !== 0 && ctx.fillRect(clientSize.x * -0.5, clientSize.y * -0.5, clientTextSize.x, clientTextSize.y);
                }
                ctx.restore();
        
                // Text
                ctx.fillStyle = strokeColor;
                ctx.strokeStyle = strokeColor;
                ctx.textBaseline = 'Alphabetic';
                ctx.translate(center.x - (clientSize.x * 0.5), center.y - (clientSize.y * 0.5) + clientLineHeight);
                //ctx.rotate(rotation);
                ctx.font = fontStyle + " " + fontWeight + " " + fontSize + "px " + fontFamily;
                ctx.globalAlpha = fontOpacity;
                renderLinesOfText(ctx, this.currentTextLines, clientLineHeight, clientSize.y);
            };
        
            proto.getTransform = function () {
        
                var x = this.position.x - this.size.x * 0.5;
                var y = this.position.y + this.size.y * 0.5;
        
                return [
                    'translate(', x, ',', y, ')',
                    'rotate(', Utils.radiansToDegrees(-this.rotation), ')',
                    'scale(1,-1)'
                ].join(' ');
            };
        
            proto.getTextTransform = function () {
        
                var lineHeight = this.getLineHeight();
        
                var x = this.position.x - this.size.x * 0.5;
                var y = this.position.y + this.size.y * 0.5 - lineHeight;
        
                return [
                    'translate(', x, ',', y, ')',
                    'rotate(', Utils.radiansToDegrees(-this.rotation), ')',
                    'scale(1,-1)'
                ].join(' ');
            };
        
            proto.cloneShape = function (clone) {
        
                clone.shape = Utils.createMarkupTextSvg();
                clone.bindDomEvents();
            };

            return MarkupText;
});