define([
    './Utils',
    '../../Core/i18n'
], function(Utils, i18n) {
    'use strict';
    var DEFAULT_TEXT = 'Write Something';
    
        /**
         * Auxiliary class that handles all input for the Label Markup (MarkupText.js)
         * It instantiates a TEXTAREA where the user can input text. When user input is
         * disabled, the textarea gets hidden and further rendering is delegated to
         * MarkupText.js
         *
         * @param {HTMLElement} parentDiv
         * @param {Object} editor - Core Extension
         * @constructor
         */
        function EditorTextInput(parentDiv, editor) {
    
            this.parentDiv = parentDiv;
            this.editor = editor;
    
            // Constants
            this.EVENT_TEXT_CHANGE = 'EVENT_CO2_TEXT_CHANGE';
    
            // The actual TextArea input
            this.textArea = document.createElement('textarea');
            this.textArea.setAttribute('maxlength', '260'); // TODO: Make constant? Change value?
            this.textArea.setAttribute('data-i18n', DEFAULT_TEXT);
    
            this.onKeyHandlerBinded = this.onKeyHandler.bind(this);
            this.textArea.addEventListener('keydown', this.onKeyHandlerBinded);
    
            this.styleTextArea = new Utils.DomElementStyle(); // TODO: Move this to EditMode.
            this.styleTextArea
                .setAttribute('position', 'absolute')
                .setAttribute('overflow-y', 'hidden');
    
            // Helper div to measure text width
            this.measureDiv = document.createElement('div');
    
            // Become an event dispatcher
            Utils.addTraitEventDispatcher(this);
    
            this.onResizeBinded = this.onWindowResize.bind(this);
        }
    
        var proto = EditorTextInput.prototype;
    
        proto.destroy = function () {
    
            this.textArea.removeEventListener('keydown', this.onKeyHandlerBinded);
            this.setInactive();
        };
    
        /**
         * Initializes itself given an Label Markup (textMarkup)
         * @param {Object} textMarkup
         * @param {Boolean} firstEdit - Whether the markup is being edited for the first time.
         */
        proto.setActive = function (textMarkup, firstEdit) {
    
            if (this.textMarkup === textMarkup) {
                return;
            }
    
    
            var placeholderText = i18n.translate(DEFAULT_TEXT);
            this.textArea.setAttribute('placeholder', placeholderText);
    
            this.setInactive();
            this.parentDiv.appendChild(this.textArea);
            this.textMarkup = textMarkup;
            this.firstEdit = firstEdit || false;
            this.initFromMarkup();
    
            // Component breaks when resizing. Thus, we force close it
            window.addEventListener('resize', this.onResizeBinded);
    
            // Focus on next frame
            var txtArea = this.textArea;
            window.requestAnimationFrame(function () {
                txtArea.focus();
            });
        };
    
        /**
         * Closes the editor text input and goes back into normal markup edition mode.
         */
        proto.setInactive = function () {
    
            window.removeEventListener('resize', this.onResizeBinded);
    
            if (this.textMarkup) {
                this.textMarkup = null;
                this.parentDiv.removeChild(this.textArea);
            }
            this.style = null;
        };
    
        proto.isActive = function () {
    
            return !!this.textMarkup;
        };
    
        /**
         * Applies Markup styles to TextArea used for editing.
         * It also saves a copy of the style object.
         * @private
         */
        proto.initFromMarkup = function () {
    
            var markup = this.textMarkup;
            var position = markup.getClientPosition(),
                size = markup.getClientSize();
    
            var left = position.x - size.x * 0.5;
            var top = position.y - size.y * 0.5;
    
            var lineHeightPercentage = markup.lineHeight + "%";
            this.styleTextArea.setAttribute('line-height', lineHeightPercentage);
    
            this.setPosAndSize(left, top, size.x, size.y);
            this.setStyle(markup.getStyle());
            this.textArea.value = markup.getText();
        };
    
        proto.setPosAndSize = function (left, top, width, height) {
    
            // We also check here that it doesn't overflow out of the canvas
            if (left + width >= this.editor.viewer.container.clientWidth) {
                left = this.editor.viewer.container.clientWidth - (width + 10);
            }
            if (top + height >= this.editor.viewer.container.clientHeight) {
                top = this.editor.viewer.container.clientHeight - (height + 10);
            }
    
            this.styleTextArea
                // Size and position
                .setAttribute('left', left + 'px')
                .setAttribute('top', top + 'px')
                .setAttribute('width', width + 'px')
                .setAttribute('height', height + 'px');
        };
    
        proto.setStyle = function (style) {
    
            if (this.style) {
                // An already present style means that the user
                // has changed the style using the UI buttons.
                // We need to account for the user having changed the
                // width/height of the TextArea. Since there is no event
                // we can detect for it, we do it here.
                var temp = {};
                this.injectSizeValues(temp);
                this.setPosAndSize(
                    temp.newPos.x - temp.width * 0.5,
                    temp.newPos.y - temp.height * 0.5,
                    temp.width, temp.height);
            }
            var fontHeight = this.editor.sizeFromMarkupsToClient(0, style['font-size']).y;
            var textAreaStyle = this.styleTextArea
                // Visuals
                .setAttribute('color', style['stroke-color'])
                .setAttribute('font-family', style['font-family'])
                .setAttribute('font-size', fontHeight + 'px')
                .setAttribute('font-weight', style['font-weight'])
                .setAttribute('font-style', style['font-style'])
                .getStyleString();
            this.textArea.setAttribute('style', textAreaStyle);
            this.style = Utils.cloneStyle(style);
        };
    
        /**
         * Helper function that, for a given markup with some text in it
         * returns an Array of lines in it.
         * @param {Object} markup
         * @returns {{text, lines}|{text: String, lines: Array.<String>}}
         */
        proto.getTextValuesForMarkup = function (markup) {
    
            var active = this.isActive();
            var activeMarkup = this.textMarkup;
            var activeFirstEdit = this.firstEdit;
    
            this.setActive(markup, false);
            var textValues = this.getTextValues();
    
            if (active) {
                this.setActive(activeMarkup, activeFirstEdit);
            } else {
                this.setInactive();
            }
    
            return textValues;
        };
    
        /**
         * Returns the current text as one string and an array of lines
         * of how the text is being rendered (1 string per line)
         * @returns {{text: String, lines: Array.<String>}}
         */
        proto.getTextValues = function () {
    
            var newText = this.textArea.value;
            if (newText === DEFAULT_TEXT) {
                newText = '';
            }
            return {
                text: newText,
                lines: this.generateLines()
            };
        };
    
        /**
         * Function called by UI
         */
        proto.acceptAndExit = function () {
    
            // If placeholder text, then remove.
            var textValues = this.getTextValues();
    
            var dataBag = {
                markup: this.textMarkup,
                style: this.style,
                firstEdit: this.firstEdit,
                newText: textValues.text,
                newLines: textValues.lines
            };
            this.injectSizeValues(dataBag);
            this.fireEvent({ type: this.EVENT_TEXT_CHANGE, data: dataBag });
            this.setInactive(); // Do this last //
        };
    
        /**
         * Injects position, width and height of the textarea rect
         * @param {Object} dataBag
         * @private
         */
        proto.injectSizeValues = function (dataBag) {
    
            // Explicit usage of parseFloat to remove the 'px' suffix.
            var width = parseFloat(this.textArea.style.width);
            var height = parseFloat(this.textArea.style.height);
            var ox = parseFloat(this.textArea.style.left);
            var oy = parseFloat(this.textArea.style.top);
    
            dataBag.width = width;
            dataBag.height = height;
            dataBag.newPos = {
                x: ox + (width * 0.5),
                y: oy + (height * 0.5)
            };
        };
    
        /**
         * Handler for when the window gets resized
         * @param {Object} event - Window resize event
         * @private
         */
        proto.onWindowResize = function (event) {
            window.requestAnimationFrame(function () {
                var str = this.textArea.value;
                this.style = null; // TODO: Revisit this code because style changes are lost by doing this.
                this.initFromMarkup();
                this.textArea.value = str;
            }.bind(this));
        };
    
        proto.onKeyHandler = function (event) {
            var keyCode = event.keyCode;
            var shiftDown = event.shiftKey;
    
            // We only allow RETURN when used along with SHIFT
            if (!shiftDown && keyCode === 13) { // Return
                event.preventDefault();
                this.acceptAndExit();
            }
        };
    
        /**
         * Grabs the text content of the textarea and returns
         * an Array of lines.  Wrapped lines are returned as 2 lines.
         */
        proto.generateLines = function () {
    
            // First, get lines separated by line breaks:
            var textContent = this.textArea.value;
            var linesBreaks = textContent.split(/\r*\n/);
    
            var styleMeasureStr = this.styleTextArea.clone()
                .removeAttribute(['top', 'left', 'width', 'height', 'overflow-y'])
                .setAttribute('position', 'absolute')
                .setAttribute('white-space', 'nowrap')
                .setAttribute('float', 'left')
                .setAttribute('visibility', 'hidden')
                .getStyleString();
            this.measureDiv.setAttribute('style', styleMeasureStr);
            this.parentDiv.appendChild(this.measureDiv);
    
            var maxLineLength = parseFloat(this.textArea.style.width);
    
            // Now check whether the lines are wrapped.
            // If so, subdivide into other lines.
            var linesOutput = [];
    
            for (var i = 0, len = linesBreaks.length; i < len; ++i) {
                var line = trimRight(linesBreaks[i]);
                this.splitLine(line, maxLineLength, linesOutput);
            }
    
            this.parentDiv.removeChild(this.measureDiv);
            return linesOutput;
        };
    
        /**
         * Given a String that represents one line of text that is
         * longer than the max length a line is allowed, this method
         * cuts text into several ones that are no longer than the max
         * length.
         *
         * @param {String} text
         * @param {Number} maxLength
         * @param {Array} output
         * @private
         */
        proto.splitLine = function (text, maxLength, output) {
    
            // End condition
            if (text === '') {
                return;
            }
    
            var remaining = '';
            var done = false;
    
            while (!done) {
                this.measureDiv.innerHTML = text;
                var lineLen = this.measureDiv.clientWidth;
                if (lineLen <= maxLength) {
                    output.push(text);
                    this.splitLine(trimLeft(remaining), maxLength, output);
                    done = true;
                } else {
                    // Need to try with a shorter word!
                    var parts = this.getShorterLine(text);
                    if (parts.length === 1) {
                        // text is only one word that is way too long.
                        this.splitWord(text, remaining, maxLength, output);
                        done = true;
                    } else {
                        text = parts[0];
                        remaining = parts[1] + remaining;
                    }
                }
            }
        };
    
        /**
         * Given a line of text such as "hi there programmer", it returns
         * an array with 2 parts: ["hi there", " programmer"].
         *
         * It accounts for special cases with multi-spaces, such as for
         * "hi there  two-spaces" returns ["hi there", "  two-spaces"]
         *
         * When there is only one word, it returns the whole word:
         * "JustOneWord" returns ["JustOneWord"] (an array of 1 element)
         *
         * @param {String} line
         * @returns {Array}
         */
        proto.getShorterLine = function (line) {
    
            // TODO: Account for TABs
            // Will probably never do unless a bug is reported.
    
            var iLastSpace = line.lastIndexOf(' ');
            if (iLastSpace === -1) {
                return [line]; // This is a single word
            }
    
            // Else
            // Iterate back removing additional spaces (multi spaces)
            while (line.charAt(iLastSpace - 1) === ' ') {
                iLastSpace--
            }
    
            var trailingWord = line.substr(iLastSpace); // Contains the spaces
            var shorterLine = line.substr(0, iLastSpace);
            return [shorterLine, trailingWord];
        };
    
        /**
         * Given a single word, splits it into multiple lines that fits in maxWidth
         * @param {String} word
         * @param {String} remaining
         * @param {Number} maxLength
         * @param {Array} output
         */
        proto.splitWord = function (word, remaining, maxLength, output) {
    
            var lenSoFar = 1;
            var fits = true;
            while (fits) {
    
                var part = word.substr(0, lenSoFar);
                this.measureDiv.innerHTML = part;
                var lineLen = this.measureDiv.clientWidth;
    
                if (lineLen > maxLength) {
    
                    if (lenSoFar === 1) {
                        // we can't split 1 character any longer.
                        output.push(part);
                        this.splitWord(word.substr(1), remaining, maxLength, output);
                        return;
                    }
    
                    // It was fine until one less char //
                    var okayWord = word.substr(0, lenSoFar - 1);
                    output.push(okayWord);
                    var extraWord = word.substr(lenSoFar - 1);
                    this.splitLine(extraWord + remaining, maxLength, output);
                    return;
                }
    
                // Try one more character
                lenSoFar++;
    
                // Check if we are done with all characters
                if (lenSoFar > word.length) {
                    // Okay it fits
                    output.push(word);
                    return;
                }
            }
        };
    
        function trimRight(text) {
            if (text.length === 0) {
                return "";
            }
            var lastNonSpace = text.length - 1;
            for (var i = lastNonSpace; i >= 0; --i) {
                if (text.charAt(i) !== ' ') {
                    lastNonSpace = i;
                    break;
                }
            }
            return text.substr(0, lastNonSpace + 1);
        }
    
        function trimLeft(text) {
            if (text.length === 0) {
                return "";
            }
            var firstNonSpace = 0;
            for (var i = 0; i < text.length; ++i) {
                if (text.charAt(i) !== ' ') {
                    firstNonSpace = i;
                    break;
                }
            }
            return text.substr(firstNonSpace);
        }

        return EditorTextInput;
});