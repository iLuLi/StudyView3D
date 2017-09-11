define([
    '../../Core/ToolInterface',
    '../../Core/Constants/KeyCode'
], function(ToolInterface, KeyCode) {
    'use strict';
    function MarkupTool() {
        
                ToolInterface.call(this);
                this.names = ["markups.core"];
                this.panTool = null;
                this.allowNav = false;
        
                this.coreExt = null;
                this.hotkeysEnabled = true;
        
                var _ctrlDown = false;
                var _shiftDown = false;
        
                // Non-ToolInterface methods //
        
                this.allowNavigation = function (allow) {
                    this.allowNav = allow;
                };
                this.setCoreExtension = function (coreExt) {
                    this.coreExt = coreExt;
                };
                this.setHotkeysEnabled = function (enabled) {
                    this.hotkeysEnabled = enabled;
                };
        
        
                // ToolInterface methods //
        
                this.activate = function (name, viewerApi) {
                    this.panTool = viewerApi.toolController.getTool("pan");
                    if (this.panTool) {
                        this.panTool.activate("pan"); // TODO: What if we want "zoom" here?
                    }
                };
                this.deactivate = function (name) {
                    if (this.panTool) {
                        this.panTool.deactivate("pan");
                    }
                    this.panTool = null;
                };
        
                this.handleKeyDown = function (event, keyCode) {
        
                    if (!this.hotkeysEnabled) {
                        return true; // Consume event
                    }
        
                    // Don't propagate key handling down to tool //
        
                    switch (keyCode) {
                        case KeyCode.CONTROL: _ctrlDown = true; break;
                        case KeyCode.SHIFT: _shiftDown = true; break;
        
                        case KeyCode.x: _ctrlDown && !this.allowNav && this.coreExt.cut(); break;
                        case KeyCode.c: _ctrlDown && !this.allowNav && this.coreExt.copy(); break;
                        case KeyCode.v: _ctrlDown && !this.allowNav && this.coreExt.paste(); break;
                        case KeyCode.d:
                            if (_ctrlDown && !this.allowNav) {
                                // Duplicate
                                this.coreExt.copy();
                                this.coreExt.paste();
                            }
                            break;
                        case KeyCode.z:
                            if (_ctrlDown && !_shiftDown && !this.allowNav) {
                                this.coreExt.undo();
                            }
                            else if (_ctrlDown && _shiftDown && !this.allowNav) {
                                this.coreExt.redo(); // Also support Ctrl+Y
                            }
                            break;
                        case KeyCode.y: _ctrlDown && !this.allowNav && this.coreExt.redo(); break; // Also support ctrl+shift+z
                        case KeyCode.ESCAPE: this.coreExt.onUserCancel(); break;
        
                        case KeyCode.BACKSPACE: // Fall through
                        case KeyCode.DELETE:
                            var selectedMarkup = this.coreExt.getSelection();
                            if (selectedMarkup) {
                                this.coreExt.deleteMarkup(selectedMarkup);
                            }
                            break;
                        case KeyCode.F12:
                            return false; // To allow opening developer console.
                            break;
                        default: break;
                    }
        
                    return true; // Consume event
                };
                this.handleKeyUp = function (event, keyCode) {
        
                    if (!this.hotkeysEnabled) {
                        return true; // Consume event
                    }
        
                    // Don't propagate key handling down to tool
        
                    switch (keyCode) {
                        case KeyCode.CONTROL: _ctrlDown = false; break;
                        case KeyCode.SHIFT: _shiftDown = false; break;
                        default: break;
                    }
        
                    return true; // Consume event ONLY
                };
        
                this.update = function () {
                    if (this.allowNav && this.panTool && this.panTool.update) {
                        return this.panTool.update();
                    }
                    return false;
                };
        
                this.handleSingleClick = function (event, button) {
                    if (this.allowNav) {
                        // If pan tool won't handle single click, then pass over the event.
                        if (this.panTool && this.panTool.handleSingleClick)
                            return this.panTool.handleSingleClick(event, button);
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleDoubleClick = function (event, button) {
                    if (this.allowNav) {
                        // If pan tool won't handle double click, then pass over the event
                        if (this.panTool && this.panTool.handleDoubleClick) {
                            return this.panTool.handleDoubleClick(event, button);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleSingleTap = function (event) {
                    if (this.allowNav) {
                        // If pan tool won't handle single tap, then pass over the event
                        if (this.panTool && this.panTool.handleSingleTap) {
                            return this.panTool.handleSingleTap(event);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleDoubleTap = function (event) {
                    if (this.allowNav) {
                        // If pan tool won't handle double tap, then pass over the event
                        if (this.panTool && this.panTool.handleDoubleTap) {
                            return this.panTool.handleDoubleTap(event);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleWheelInput = function (delta) {
                    if (this.allowNav) {
                        // If pan tool won't handle wheel input, then pass over the event
                        if (this.panTool && this.panTool.handleWheelInput) {
                            return this.panTool.handleWheelInput(delta);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleButtonDown = function (event, button) {
                    if (this.allowNav) {
                        // If pan tool won't handle button down, then pass over the event
                        if (this.panTool && this.panTool.handleButtonDown) {
                            return this.panTool.handleButtonDown(event, button);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleButtonUp = function (event, button) {
                    if (this.allowNav) {
                        // If pan tool won't handle button up, then pass over the event
                        if (this.panTool && this.panTool.handleButtonUp) {
                            return this.panTool.handleButtonUp(event, button);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleMouseMove = function (event) {
                    if (this.allowNav) {
                        // If pan tool won't handle button move, then pass over the event
                        if (this.panTool && this.panTool.handleMouseMove) {
                            return this.panTool.handleMouseMove(event);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleGesture = function (event) {
                    if (this.allowNav) {
                        // If pan tool won't handle gesture, then pass over the event
                        if (this.panTool && this.panTool.handleGesture) {
                            return this.panTool.handleGesture(event);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
                this.handleBlur = function (event) {
                    if (this.allowNav) {
                        // If pan tool won't handle blur, then pass over the event
                        if (this.panTool && this.panTool.handleBlur) {
                            return this.panTool.handleBlur(event);
                        }
                        else
                            return false;
                    }
                    return true; // Consume event
                };
            }


            return MarkupTool;
});