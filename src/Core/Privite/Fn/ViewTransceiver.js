define([
    '../../EventType',
    '../ViewerState',
    '../../EventDispatcher'
], function(EventType, ViewerState, EventDispatcher) {
    'use strict';

    var ViewTransceiver = function (client) {

        var _this = this;
        var _viewer = this.viewer = null;
        var _blockEvents = false;
        var _haveControl = false;
        var _isDisconnected = false;
        var _lastInControl;
        var _client = this.client = client;
        var _ray = new THREE.Ray();
        var _pointer = null;
        var _pointerOn = false;

        this.channelId = null;

        var _viewerState;
        var VIEWER_STATE_FILTER = {
            seedURN: false,
            objectSet: true,
            viewport: false,
            cutplanes: true,
            renderOptions: {
                environment: false,
                ambientOcclusion: false,
                toneMap: {
                    exposure: false
                },
                appearance: false
            }
        };


        function onViewerState(evt) {
            _blockEvents = true;
            var state = JSON.parse(evt.data.msg);
            _viewerState.restoreState(state);
            _viewer.impl.invalidate(true, false, true);
            _blockEvents = false;
        }

        function reduceBits(v) {
            return Math.round(v * 1000) / 1000;
        }

        function reduceBitsV(v) {
            for (var i = 0; i < v.length; i++)
                v[i] = reduceBits(v[i]);
        }

        function onCamera(e) {
            var v = e.data.msg;

            if (v[1] === true || _isDisconnected) {
                return;
            }

            if (v[0] != _lastInControl) {
                _lastInControl = v[0];
                e.data.lastInControl = v[0];
                _this.dispatchEvent({ type: "controlChange", channelId: _this.channelId, data: e.data });
            }

            //For now, automatically relinquish camera control if we receive a remote command to move the camera
            _haveControl = false;

            /*
                viewer.navigation.setRequestTransitionWithUp(true, new THREE.Vector3().set(v[1+0],v[1+1],v[1+2]),
                new THREE.Vector3().set(v[1+3],v[1+4],v[1+5]),
                _viewer.navigation.getCamera().fov,
                new THREE.Vector3().set(v[1+6],v[1+7],v[1+8]));
                */

            _viewer.navigation.setView(new THREE.Vector3().set(v[2 + 0], v[2 + 1], v[2 + 2]),
                new THREE.Vector3().set(v[2 + 3], v[2 + 4], v[2 + 5]));
            _viewer.navigation.setCameraUpVector(new THREE.Vector3().set(v[2 + 6], v[2 + 7], v[2 + 8]));
        }

        function sendCamera(evt) {
            if (!_haveControl && !_isDisconnected)
                return;

            var c = evt.camera;
            var camParams = [c.position.x, c.position.y, c.position.z,
                c.target.x, c.target.y, c.target.z,
                c.up.x, c.up.y, c.up.z
            ];

            reduceBitsV(camParams);
            camParams.unshift(_isDisconnected);
            camParams.unshift(client.getLocalId());

            _client.sendMessage("camera", camParams, _this.channelId);

            if (_lastInControl != camParams[0]) {
                _lastInControl = camParams[0];
                _this.dispatchEvent({ type: "controlChange", channelId: _this.channelId, data: { lastInControl: _lastInControl } });
            }
        }


        function showPointer(show, x, y) {

            if (show && !_pointer) {
                _pointer = document.createElement("div");
                _pointer.classList.add("collabPointer");
            }

            if (show && !_pointerOn) {
                _viewer.container.appendChild(_pointer);
                _pointerOn = true;
            }
            else if (!show && _pointerOn) {
                _viewer.container.removeChild(_pointer);
                _pointerOn = false;
            }

            if (show) {
                //Note the 4px is half the width/height specified in the CSS,
                //so that the pointer is centered.
                _pointer.style.left = (x - 6) + "px";
                _pointer.style.top = (y - 6) + "px";
            }

        }

        function onPointer(e) {

            if (_haveControl)
                return; //shouldn't get here in theory, but let's check just in case

            if (_isDisconnected)
                return; //we can't show the pointer if the views don't match

            var v = e.data.msg;
            _ray.origin.set(v[1], v[2], v[3]);
            _ray.direction.set(v[4], v[5], v[6]);

            var pt = _ray.at(_viewer.getCamera().near);
            pt.project(_viewer.getCamera());

            pt = _viewer.impl.viewportToClient(pt.x, pt.y);

            //avp.logger.log(pt.x + " " + pt.y);
            showPointer(true, pt.x, pt.y);
        }


        function sendPointer(evt) {
            if (!_haveControl)
                return;

            //Note canvasX/Y are set by the ToolController to clientX/Y - canvas left/top.
            var vpVec = _viewer.impl.clientToViewport(evt.canvasX, evt.canvasY);
            _viewer.impl.viewportToRay(vpVec, _ray);

            var rayParams = [_ray.origin.x, _ray.origin.y, _ray.origin.z,
                _ray.direction.x, _ray.direction.y, _ray.direction.z];

            reduceBitsV(rayParams);
            rayParams.unshift(client.getLocalId());

            _client.sendMessage("pointer", rayParams, _this.channelId);
        }


        function sendViewerState(e) {
            //if (!_haveControl)
            //    return;
            if (_blockEvents)
                return;

            var state = _viewerState.getState(VIEWER_STATE_FILTER);

            // TODO: if we kill the socket.io code path, this could be optimized
            // too by removing the JSON.stringify of the state. Pubnub automatically
            // does JSON serialization for us, with optimizations accordingly to their manual.
            client.sendMessage("state", JSON.stringify(state), _this.channelId);
        }


        this.takeControl = function () {
            _haveControl = true;
            showPointer(false);
        };

        this.updatePointer = function (e) {
            sendPointer(e);
        };

        this.connectCamera = function (set) {
            _isDisconnected = !set;
        };

        this.attach = function (viewer, skipStateTracking) {

            if (_viewer)
                this.detach();

            this.viewer = _viewer = viewer;
            _viewerState = new ViewerState(_viewer);

            _client.addEventListener("cameraChange", onCamera);
            _client.addEventListener("pointerMove", onPointer);

            if (!_viewer.hasEventListener(EventType.CAMERA_CHANGE_EVENT, sendCamera))
                _viewer.addEventListener(EventType.CAMERA_CHANGE_EVENT, sendCamera);

            if (!skipStateTracking) {
                _client.addEventListener("viewerState", onViewerState);

                if (!_viewer.hasEventListener(EventType.SELECTION_CHANGED_EVENT, sendViewerState)) {
                    _viewer.addEventListener(EventType.SELECTION_CHANGED_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.ISOLATE_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.HIDE_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.SHOW_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.EXPLODE_CHANGE_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.LAYER_VISIBILITY_CHANGED_EVENT, sendViewerState);
                    _viewer.addEventListener(EventType.CUTPLANES_CHANGE_EVENT, sendViewerState);
                }
            }
        };


        this.detach = function () {

            showPointer(false);

            if (_client) {
                _client.removeEventListener("cameraChange", onCamera);
                _client.removeEventListener("viewerState", onViewerState);
            }

            if (_viewer) {
                _viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, sendCamera);

                _viewer.removeEventListener(EventType.SELECTION_CHANGED_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.ISOLATE_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.HIDE_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.SHOW_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.EXPLODE_CHANGE_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.LAYER_VISIBILITY_CHANGED_EVENT, sendViewerState);
                _viewer.removeEventListener(EventType.CUTPLANES_CHANGE_EVENT, sendViewerState);

                this.viewer = _viewer = null;
                _viewerState = null;
            }
        };

    };

    ViewTransceiver.prototype.constructor = ViewTransceiver;
    EventDispatcher.prototype.apply(ViewTransceiver.prototype);

    return ViewTransceiver;
});