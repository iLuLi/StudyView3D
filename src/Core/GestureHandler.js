define([
    './DeviceType',
    'Hammer'
], function(DeviceType, factory) {
    'use strict';
    var GestureHandler = function (viewerApi) {
    
        var _navapi = viewerApi.navigation;
        var _names = ["gestures"];
        var _this = this;
        var _mouseEnabled = true;
        var _twoPointerSwipeEnabled = true;
        var hammer = null;
    
        var isTouch = DeviceType.isTouchDevice;
    
        _navapi.setIsTouchDevice(isTouch);
        if (isTouch) {
            hammer = new Hammer.Manager(viewerApi.canvasWrap, {
                recognizers: [
                    // RecognizerClass, [options], [recognizeWith, ...], [requireFailure, ...]
                    [Hammer.Pan, { event: 'drag', pointers: 1 }],
                    [Hammer.Tap, { event: 'doubletap', taps: 2, interval: 300, threshold: 6, posThreshold: 30 }],
                    [Hammer.Tap, { event: 'doubletap2', pointers: 2, taps: 2, interval: 300, threshold: 6, posThreshold: 40 }],
                    [Hammer.Tap, { event: 'singletap2', pointers: 2, threshold: 3 }],
                    [Hammer.Tap, { event: 'singletap', threshold: 2 }],
                    [Hammer.Press, { event: 'press', time: 500 }],
                    [Hammer.Pan, { event: 'drag3', pointers: 3, threshold: 15 }],
    
                    // Note: These recognizers are active only when _twoPointerSwipeEnabled is true
                    [Hammer.Pan, { event: 'pan', pointers: 2, threshold: 20 }],
                    [Hammer.Pinch, { enable: true, threshold: 0.05 }],
                    [Hammer.Rotate, { enable: true, threshold: 7.0 }]
                ],
                inputClass: Hammer.TouchInput
            });
            viewerApi.canvasWrap.addEventListener('touchstart', this.onTouchStart, false);
        }
    
        this.onTouchStart = function (event) {
            event.preventDefault();
        };
    
        this.getNames = function () {
            return _names;
        };
    
        this.getName = function () {
            return _names[0];
        };
    
        /**
        function dirToString(obj) {
            var output = [];
            for(var key in obj) {
                if(obj.hasOwnProperty(key)) {
                    var value = obj[key];
                    if(Array.isArray(value)) {
                        value = "Array("+ value.length +"):"+ value;
                    } else if(value instanceof HTMLElement) {
                        value = value +" ("+ value.outerHTML.substring(0, 50) +"...)";
                    }
                    output.push(key +": "+ value);
                }
            }
            return output.join("\n")
        };
        **/
    
    
        this.__clientToCanvasCoords = function (event) {
            var rect = viewerApi.impl.canvas.getBoundingClientRect();
            var width = rect.width;
            var height = rect.height;
    
            // Canvas coordinates: relative to the canvas element.
            // 0 = top left, +ve right and down.
            //
            var canvasX, canvasY;
    
            if (event.hasOwnProperty("center")) {
                canvasX = event.center.x - rect.left;
                canvasY = event.center.y - rect.top;
            }
            else {
                canvasX = event.pointers[0].clientX - rect.left;
                canvasY = event.pointers[0].clientY - rect.top;
            }
            event.canvasX = canvasX;
            event.canvasY = canvasY;
    
            // Normalized coordinates: [-1, +1].
            // 0 = center, +ve = right and up.
            //
            event.normalizedX = (canvasX / width) * 2.0 - 1.0;
            event.normalizedY = ((height - canvasY) / height) * 2.0 - 1.0;
        };
    
    
        this.distributeGesture = function (event) {
            function endsWith(str, suffix) {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }
    
            _this.__clientToCanvasCoords(event);
    
            if (_this.controller.distributeEvent("handleGesture", event))
                event.preventDefault();
    
            if (endsWith(event.type, "end"))
                hammer.stop();  // Don't allow chained gestures.
        };
    
        this.onSingleTap = function (event) {
            _this.__clientToCanvasCoords(event);
    
            if (_this.controller.distributeEvent("handleSingleTap", event))
                event.preventDefault();
        };
    
        this.onDoubleTap = function (event) {
            _this.__clientToCanvasCoords(event);
    
            if (_this.controller.distributeEvent("handleDoubleTap", event))
                event.preventDefault();
        };
    
        this.onPressHold = function (event) {
            _this.__clientToCanvasCoords(event);
    
            // Slight hack to stop the mouse down event that the browser
            // generates during a press hold:
            if (event.type === "press")
                _mouseEnabled = _this.controller.enableMouseButtons(false);
            else
                _this.controller.enableMouseButtons(_mouseEnabled);
    
            if (_this.controller.distributeEvent("handlePressHold", event))
                event.preventDefault();
        };
    
        this.activate = function (name) {
            if (hammer) {
                hammer.on("dragstart dragmove dragend", this.distributeGesture);
                hammer.on("singletap", this.onSingleTap);
                hammer.on("singletap2", this.onSingleTap);
                hammer.on("doubletap", this.onDoubleTap);
                hammer.on("doubletap2", this.onDoubleTap);
                hammer.on("press pressup", this.onPressHold);
                hammer.on("drag3start drag3move drag3end", this.distributeGesture);
    
                if (_twoPointerSwipeEnabled) {
                    hammer.on("panstart panmove panend", this.distributeGesture);
                    hammer.on("pinchstart pinchmove pinchend", this.distributeGesture);
                    hammer.on("rotatestart rotatemove rotateend", this.distributeGesture);
                }
    
                // we only want to trigger a tap, when we don't have detected a doubletap
                hammer.get('doubletap2').recognizeWith('doubletap');
                hammer.get('singletap2').recognizeWith('singletap');
                hammer.get('singletap').requireFailure('doubletap');
            }
        };
    
        this.deactivate = function (name) {
            if (hammer) {
                hammer.off("dragstart dragmove dragend", this.distributeGesture);
                hammer.off("singletap", this.onSingleTap);
                hammer.off("singletap2", this.onSingleTap);
                hammer.off("doubletap", this.onDoubleTap);
                hammer.off("doubletap2", this.onDoubleTap);
                hammer.off("press pressup", this.onPressHold);
                hammer.off("drag3start drag3move drag3end", this.distributeGesture);
    
                if (_twoPointerSwipeEnabled) {
                    hammer.off("panstart panmove panend", this.distributeGesture);
                    hammer.off("pinchstart pinchmove pinchend", this.distributeGesture);
                    hammer.off("rotatestart rotatemove rotateend", this.distributeGesture);
                }
            }
        };
    
    
        this.update = function () {
            return false;
        };
    
    
        this.handleBlur = function (event) {
            return false;
        };
    
        /**
         * Disables two finger swipe functionality (pan, rotate, zoom) so that a
         * mobile user can scroll the page where the viewer is being embedded.
         */
        this.disableTwoFingerSwipe = function () {
            _twoPointerSwipeEnabled = false;
            if (hammer) {
                hammer.remove(Hammer.Pan);
                hammer.remove(Hammer.Pinch);
                hammer.remove(Hammer.Rotate);
                hammer.off("panstart panmove panend", this.distributeGesture);
                hammer.off("pinchstart pinchmove pinchend", this.distributeGesture);
                hammer.off("rotatestart rotatemove rotateend", this.distributeGesture);
            }
        }
    };

    return GestureHandler;
});