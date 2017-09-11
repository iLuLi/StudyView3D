define([
    '../../Core/ToolInterface',
    '../../Core/Constants/EventType',
], function(ToolInterface, EventType) {
    'use strict';
    var HyperlinkTool = function (viewer) {
        ToolInterface.call(this);
        this.names = ['hyperlink'];

        var _dbId = -1;
        var _dragging = false;
        var _linkCache = {};
        var _tooltip = null;

        var _showTooltip = function (x, y, linkCache) {
            if (!_tooltip) {
                _tooltip = document.createElement('div');
                viewer.container.appendChild(_tooltip);
            }
            _tooltip.className = 'hyperlink-tooltip';
            _tooltip.style.top = (y + 20) + 'px';
            _tooltip.style.left = (x + 20) + 'px';

            var link = linkCache.link;
            if (linkCache.node) {
                link = linkCache.node.name();
            }

            var text = link + ' (CTRL+click)';
            _tooltip.innerText = text;
        };

        var _hideTooltip = function () {
            if (_tooltip) {
                viewer.container.removeChild(_tooltip);
                _tooltip = null;
            }
        };

        var _onGeometryLoaded = function (event) {
        };

        var _onModelUnloaded = function (event) {
            _hideTooltip();
            _linkCache = {};
        };

        this.activate = function (name) {
            viewer.addEventListener(EventType.GEOMETRY_LOADED_EVENT, _onGeometryLoaded);
            viewer.addEventListener(EventType.MODEL_UNLOADED_EVENT, _onModelUnloaded);
        };

        this.deactivate = function (name) {
            viewer.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, _onGeometryLoaded);
            viewer.removeEventListener(EventType.MODEL_UNLOADED_EVENT, _onModelUnloaded);
            _hideTooltip();
        };

        this.update = function (timestamp) {
            return false;
        };

        this.handleSingleClick = function (event, button) {
            if (event.ctrlKey && _linkCache[_dbId]) {
                this.controller.setIsLocked(false);
                _hideTooltip();
                viewer.fireEvent({ type: EventType.HYPERLINK_EVENT, data: { href: _linkCache[_dbId].link } });
                return true;
            }

            return false;
        };

        this.handleButtonDown = function (event, button) {
            _dragging = true;
            return false;
        };

        this.handleButtonUp = function (event, button) {
            _dragging = false;
            return false;
        };

        this.handleMouseMove = function (event) {
            if (_dragging) {
                return;
            }

            var x = event.canvasX, y = event.canvasY;
            var pos = viewer.impl.clientToViewport(x, y);
            var dbId = viewer.impl.renderer().idAtPixel(pos.x, pos.y);
            if (dbId != _dbId) {
                _dbId = dbId;
                _hideTooltip();
            }

            // We're checking the hyperlinks lazily which means that their 1st appearance may be delayed.
            // If this is a problem, consider preloading hyperlinks during HyperlinkTool activation.
            if (_linkCache.hasOwnProperty(_dbId)) {
                if (_linkCache[_dbId] !== null) {
                    _showTooltip(x, y, _linkCache[_dbId]);
                }
            } else {
                _linkCache[_dbId] = null;
                viewer.getProperties(_dbId, function (result) {
                    var props = result.properties;
                    for (var i = 0, len = props.length; i < len; i++) {
                        var prop = props[i];
                        if (prop.displayCategory === '__hyperlink__') {
                            var linkToNode = null;
                            var link = prop.displayValue;
                            var docNode = viewer.model.getDocumentNode();
                            if (docNode) {
                                docNode = docNode.getRootNode();
                                var candidates = docNode.search({ 'viewableID': link });
                                if (candidates && candidates.length) {
                                    linkToNode = candidates[0];
                                }
                            }
                            _linkCache[_dbId] = {
                                link: link,
                                node: linkToNode
                            };
                            _showTooltip(x, y, _linkCache[_dbId]);
                            break;
                        }
                    }
                });
            }

            return false;
        };

        this.getCursor = function () {
            return _tooltip ? 'pointer' : null;
        };

    };

    return HyperlinkTool;
});