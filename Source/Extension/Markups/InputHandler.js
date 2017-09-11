define([
    'Hammer',
    './Utils'
], function(Hammer, Utils) {
    'use strict';
    function InputHandler() {
        
                this.editor = null;
                this.mousePosition = { x: 0, y: 0 };
                this.makeSameXY = false; // TODO: FIND a better way to name and communicate these.
                this.snapRotations = false;
                this.keepAspectRatio = false;
                this.constrainAxis = false;
        
                this.onTouchDragBinded = this.onTouchDrag.bind(this);
                this.onSingleTapBinded = this.onSingleTap.bind(this);
                this.onDoubleTapBinded = this.onDoubleTap.bind(this);
                this.onMouseMoveBinded = this.onMouseMove.bind(this);
                this.onMouseUpBinded = this.onMouseUp.bind(this);
                this.onMouseDownBinded = this.onMouseDown.bind(this);
                this.onMouseDoubleClickBinded = this.onMouseDoubleClick.bind(this);
        
                this.isMouseDown = false;
            }
        
            var proto = InputHandler.prototype;
        
            proto.attachTo = function (editor) {
        
                this.editor && this.detachFrom(this.editor);
                this.editor = editor;
        
                if (Utils.isTouchDevice()) {
        
                    this.hammer = new Hammer.Manager(editor.svg, {
                        recognizers: [
                            // RecognizerClass, [options], [recognizeWith, ...], [requireFailure, ...]
                            [Hammer.Pan, { event: 'drag', pointers: 1 }],
                            [Hammer.Tap, { event: 'doubletap', taps: 2, interval: 300, threshold: 6, posThreshold: 30 }],
                            [Hammer.Tap, { event: 'doubletap2', pointers: 2, taps: 2, interval: 300, threshold: 6, posThreshold: 40 }],
                            [Hammer.Tap, { event: 'singletap2', pointers: 2, threshold: 3 }],
                            [Hammer.Tap, { event: 'singletap', threshold: 2 }],
                            [Hammer.Press, { event: 'press', time: 500 }]
                        ],
                        inputClass: Hammer.TouchInput
                    });
        
                    this.hammer.get('doubletap2').recognizeWith('doubletap');
                    this.hammer.get('singletap2').recognizeWith('singletap');
                    this.hammer.get('singletap').requireFailure('doubletap');
                }
            };
        
            proto.detachFrom = function (editor) {
        
                this.hammer && this.hammer.destroy();
        
                document.removeEventListener('mousemove', this.onMouseMoveBinded, true);
                document.removeEventListener('mouseup', this.onMouseUpBinded, true);
        
                if (this.editor) {
                    this.editor.svg.removeEventListener("mousedown", this.onMouseDownBinded);
                    this.editor.svg.removeEventListener("dblclick", this.onMouseDoubleClickBinded);
                }
        
                this.editor = editor;
            };
        
            proto.enterEditMode = function () {
        
                if (this.hammer) {
                    this.hammer.on("dragstart dragmove dragend", this.onTouchDragBinded);
                    this.hammer.on("singletap", this.onSingleTapBinded);
                    this.hammer.on("singletap2", this.onSingleTapBinded);
                    this.hammer.on("doubletap", this.onDoubleTapBinded);
                    this.hammer.on("doubletap2", this.onDoubleTapBinded);
                }
        
                document.addEventListener('mousemove', this.onMouseMoveBinded, true);
                document.addEventListener('mouseup', this.onMouseUpBinded, true);
                this.editor.svg.addEventListener("mousedown", this.onMouseDownBinded);
                this.editor.svg.addEventListener("dblclick", this.onMouseDoubleClickBinded);
            };
        
            proto.leaveEditMode = function () {
        
                if (this.hammer) {
                    this.hammer.off("dragstart dragmove dragend", this.onTouchDragBinded);
                    this.hammer.off("singletap", this.onSingleTapBinded);
                    this.hammer.off("singletap2", this.onSingleTapBinded);
                    this.hammer.off("doubletap", this.onDoubleTapBinded);
                    this.hammer.off("doubletap2", this.onDoubleTapBinded);
                }
        
                document.removeEventListener("mousemove", this.onMouseMoveBinded, true);
                document.removeEventListener("mouseup", this.onMouseUpBinded, true);
                this.editor.svg.removeEventListener("mousedown", this.onMouseDownBinded);
                this.editor.svg.removeEventListener("dblclick", this.onMouseDoubleClickBinded);
            };
        
            proto.enterViewMode = function () {
        
            };
        
            proto.leaveViewMode = function () {
        
            };
        
            proto.getMousePosition = function () {
        
                return { x: this.mousePosition.x, y: this.mousePosition.y };
            };
        
            proto.onMouseMove = function (event) {
        
                processMouseEvent(this, event);
                this.editor.onMouseMove(event);
                event.preventDefault();
            };
        
            proto.onMouseDown = function (event) {
        
                processMouseEvent(this, event);
        
                this.isMouseDown = true;
                this.editor.onMouseDown(event);
                event.preventDefault();
            };
        
            proto.onMouseUp = function (event) {
        
                processMouseEvent(this, event);
        
                this.isMouseDown = false;
                this.editor.onMouseUp(event);
                event.preventDefault();
            };
        
            proto.onMouseDoubleClick = function (event) {
        
                processMouseEvent(this, event);
                this.editor.onMouseDoubleClick(event);
                event.preventDefault();
            };
        
            proto.onTouchDrag = function (event) {
        
                convertEventHammerToMouse(event);
                switch (event.type) {
                    case 'dragstart':
                        this.onMouseDown(event);
                        break;
                    case 'dragmove':
                        this.onMouseMove(event);
                        break;
                    case 'dragend':
                        this.onMouseUp(event);
                        break;
                }
                event.preventDefault();
            };
        
            proto.onSingleTap = function (event) {
        
                convertEventHammerToMouse(event);
        
                this.onMouseDown(event);
                this.onMouseUp(event);
                event.preventDefault();
            };
        
            proto.onDoubleTap = function (event) {
        
                convertEventHammerToMouse(event);
                this.onMouseDoubleClick(event);
                event.preventDefault();
            };
        
            function processMouseEvent(input, event) {
        
                var rect = input.editor.svg.getBoundingClientRect();
        
                input.makeSameXY = event.shiftKey;
                input.snapRotations = event.shiftKey;
                input.keepAspectRatio = event.shiftKey;
                input.constrainAxis = event.shiftKey;
        
                input.mousePosition.x = event.clientX - rect.left;
                input.mousePosition.y = event.clientY - rect.top;
            }
        
            function convertEventHammerToMouse(event) {
        
                // Convert Hammer touch-event X,Y into mouse-event X,Y.
                event.shiftKey = false;
                event.clientX = event.pointers[0].clientX;
                event.clientY = event.pointers[0].clientY;
            }

            return InputHandler;
});