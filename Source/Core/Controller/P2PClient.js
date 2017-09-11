define([
    '../EventDispatcher',
    '../Logger'
], function(EventDispatcher, Logger) {
    'use strict';

    var P2PClient = function (signalClient) {
        
        var _this = this;

        var _signalClient = signalClient;
        var _pc;
        var _isStarted = false;
        var _targetId;
        var _localStream;
        var _remoteStream;

        var _dataChannel;

        var _iceCandidates = [];

        var pc_config = { 'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }] };

        var pc_constraints = { 'optional': [{ 'DtlsSrtpKeyAgreement': true }] };

        // Set up audio and video regardless of what devices are present.

        var sdpConstraintsAll = {
            'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true
            }
        };

        var sdpConstraintsNone = {
            'mandatory': {
                'OfferToReceiveAudio': false,
                'OfferToReceiveVideo': false
            }
        };


        _signalClient.addEventListener("privateMessage", onMessage);



        function createPeerConnection(wantDataChannel) {
            try {

                _pc = new RTCPeerConnection(pc_config);

                _pc.onicecandidate = function (event) {
                    if (event.candidate) {
                        _signalClient.sendPrivateMessage(_targetId, {
                            type: 'candidate',
                            label: event.candidate.sdpMLineIndex,
                            id: event.candidate.sdpMid,
                            candidate: event.candidate.candidate
                        });
                    } else {
                        Logger.log('End of candidates.');
                    }
                };

                _pc.ondatachannel = function (event) {
                    Logger.log('Data channel added.');
                    _dataChannel = event.channel;
                    _dataChannel.onmessage = onDataMessage;
                    _this.dispatchEvent({ type: "dataChannelAdded", data: event.channel });
                };

                _pc.onaddstream = function (event) {
                    Logger.log('Remote stream added.');
                    _remoteStream = event.stream;
                    _this.dispatchEvent({ type: "remoteStreamAdded", data: event.stream });
                };

                _pc.onremovestream = function (event) {
                    Logger.log('Remote stream removed. Event: ', event);
                    _remoteStream = null;
                    _this.dispatchEvent({ type: "remoteStreamRemoved", data: event.stream });
                };

                if (wantDataChannel) {
                    _dataChannel = _pc.createDataChannel("sendDataChannel", { reliable: false, ordered: false });
                    _dataChannel.onmessage = onDataMessage;
                }
            } catch (e) {
                Logger.error('Failed to create PeerConnection, exception: ' + e.message);
                alert('Cannot create RTCPeerConnection object.');
                return;
            }
        }


        function handleCreateOfferError(event) {
            Logger.error('createOffer() error: ', e);
        }

        function setLocalAndSendMessage(sessionDescription) {
            // Set Opus as the preferred codec in SDP if Opus is present.
            //sessionDescription.sdp = preferOpus(sessionDescription.sdp);
            _pc.setLocalDescription(sessionDescription);
            //Logger.log('setLocalAndSendMessage sending message' , sessionDescription);
            _signalClient.sendPrivateMessage(_targetId, sessionDescription);

            if (_iceCandidates.length) {
                for (var i = 0; i < _iceCandidates.length; i++)
                    _pc.addIceCandidate(_iceCandidates[i]);
                _iceCandidates = [];
            }
        }
        /*
                function requestTurn(turn_url) {
                    var turnExists = false;
                    for (var i in pc_config.iceServers) {
                    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
                        turnExists = true;
                        turnReady = true;
                        break;
                    }
                    }
                    if (!turnExists) {
                    Logger.log('Getting TURN server from ', turn_url);
                    // No TURN server. Get one from computeengineondemand.appspot.com:
                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function(){
                        if (xhr.readyState === 4 && xhr.status === 200) {
                        var turnServer = JSON.parse(xhr.responseText);
                        Logger.log('Got TURN server: ', turnServer);
                        pc_config.iceServers.push({
                            'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
                            'credential': turnServer.password
                        });
                        turnReady = true;
                        }
                    };
                    xhr.open('GET', turn_url, true);
                    xhr.send();
                    }
                }
        */

        this.hangup = function () {
            Logger.log('Hanging up.');
            if (_isStarted) {
                _signalClient.sendPrivateMessage(_targetId, 'bye');
                stop();
            }
        };


        this.initUserMedia = function (createConnectionCB) {
            function handleUserMedia(stream) {
                Logger.log('Adding local stream.');
                if (createConnectionCB)
                    createConnectionCB(stream);
                _this.dispatchEvent({ type: "localStreamAdded", data: stream });
            }

            function handleUserMediaError(error) {
                Logger.error('getUserMedia error: ', error);
            }

            var constraints = { video: true, audio: true };
            window.getUserMedia(constraints, handleUserMedia, handleUserMediaError);

            Logger.log('Getting user media with constraints', constraints);
        };

        this.callUser = function (userId, dataOnly) {
            if (_targetId) {
                Logger.warn("Already in a call. Ignoring call request.");
                return;
            }

            _targetId = userId;

            Logger.info("Calling user " + _targetId);

            if (dataOnly) {
                createPeerConnection(true);

                _isStarted = true;
                Logger.log('Sending data channel offer to peer');
                _pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
            }
            else {
                this.initUserMedia(function (stream) {
                    _localStream = stream;
                    if (!_isStarted && typeof _localStream != 'undefined') {
                        createPeerConnection(false);

                        _pc.addStream(_localStream);
                        _isStarted = true;
                        Logger.log('Sending audio/video offer to peer');
                        _pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
                    }
                });
            }
        };

        function isSDPDataOnly(sdp) {
            var lines = sdp.split("\n");
            var haveData = false;
            var haveAudio = false;
            var haveVideo = false;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].indexOf("a=mid:data") == 0) {
                    haveData = true;
                }
                if (lines[i].indexOf("a=mid:video") == 0) {
                    haveVideo = true;
                }
                if (lines[i].indexOf("a=mid:audio") == 0) {
                    haveAudio = true;
                }
            }

            return haveData && !haveVideo && !haveAudio;
        }

        this.receiveCall = function (msg) {
            _targetId = msg.from;
            if (!_targetId)
                _targetId = msg.senderId;

            //Check if the caller wants audio/videio
            var sdp = msg.msg.sdp;
            if (isSDPDataOnly(sdp)) {
                createPeerConnection(true);
                _isStarted = true;

                _pc.setRemoteDescription(new RTCSessionDescription(msg.msg));
                Logger.log('Sending data-only answer to peer.');
                _pc.createAnswer(setLocalAndSendMessage, null, sdpConstraintsNone);

            } else {
                this.initUserMedia(function (stream) {
                    _localStream = stream;

                    if (!_isStarted && typeof _localStream != 'undefined') {
                        createPeerConnection(false);
                        _pc.addStream(_localStream);
                        _isStarted = true;
                    }

                    _pc.setRemoteDescription(new RTCSessionDescription(msg.msg));
                    Logger.log('Sending audio+video answer to peer.');
                    _pc.createAnswer(setLocalAndSendMessage, null, sdpConstraintsAll);
                });
            }
        };

        function onDataMessage(evt) {
            var data = JSON.parse(evt.data);

            switch (data.type) {
                case "camera": _this.dispatchEvent({ type: "cameraChange", data: data }); break;
                case "joystick": _this.dispatchEvent({ type: "joystick", data: data }); break;
                case "state": _this.dispatchEvent({ type: "viewerState", data: data }); break;
                default: break;
            }
        }


        function onMessage(evt) {
            var message = evt.data.msg;
            Logger.debug('Client received message:' + JSON.stringify(message));
            if (message.type == 'offer' && !_isStarted) {

                Logger.log("Received offer. Accepting.");
                _this.receiveCall(evt.data);

            } else if (message.type === 'answer' && _isStarted) {

                _pc.setRemoteDescription(new RTCSessionDescription(message));

            } else if (message.type === 'candidate') {

                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });

                //If we receive ICE candidates before the local
                //session is started, we have to hold them in a temp list until
                //we create the answer
                if (_isStarted)
                    _pc.addIceCandidate(candidate);
                else
                    _iceCandidates.push(candidate);

            } else if (message === 'bye' && _isStarted) {

                _this.dispatchEvent({ type: "remoteHangup", data: null });
                Logger.info('Session terminated.');
                stop();
                // isInitiator = false;

            }
        }

        function stop() {
            _isStarted = false;
            // isAudioMuted = false;
            // isVideoMuted = false;
            _pc.close();
            _pc = null;
            _localStream = null;
            _remoteStream = null;
            _targetId = null;
        }

        this.getCurrentCallTarget = function () { return _targetId; }

        this.dataChannel = function () { return _dataChannel; }
    };
    P2PClient.prototype.constructor = P2PClient;
    EventDispatcher.prototype.apply(P2PClient.prototype);

    return P2PClient;
});