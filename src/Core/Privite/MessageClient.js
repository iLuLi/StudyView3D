define([
    './Global',
    '../Logger',
    '../EventDispatcher'
], function(Privite_Global, Logger, EventDispatcher) {
    'use strict';
    var myio; //delay initialized pointer to socket.io library
    
    /** @constructor
     *
     *  MessageClient
     *  Constructs a message client object, used for server-mediate publish/subscribe
     *  message passing between connected users.
     *
     */
    function MessageClient(serverUrls, serverPath) {

        //Maps web socket commands to event types
        var MESSAGE_MAP = {
            "camera": "cameraChange",
            "pointer": "pointerMove",
            "joystick": "joystick",
            "state": "viewerState",
            "txt": "chatReceived",
            "joinok": "userListChange",
            "sessionId": "connectSucceeded",
            "joined": "userListChange",
            "left": "userListChange",
            "private": "privateMessage",
            "join_error": "socketError"
        };


        var _socket;
        var _myID = null;

        var _serverURL = Array.isArray(serverUrls) ? serverUrls : [serverUrls];
        var _currentServer = 0;

        var _pendingJoins = {};

        var _channels = {
        };

        var _this = this;

        function getUserName() {
            if (Privite_Global.config.userName && Privite_Global.config.userName.length)
                return Privite_Global.config.userName;

            if (_myID)
                return _myID.slice(0, 5);

            return "Unknown";
        }



        function onRecv(msg) {

            //See if the message requires internal processing
            switch (msg.type) {

                case "txt": onChat(msg);
                    break;

                case "joinok": onJoinOK(msg);
                    break;

                case "join_error": break;

                case "sessionId":
                    Logger.info("Connect successful, your id is: " + msg.id);
                    _myID = msg.id;
                    break;

                case "joined": msg.userStatus = "joined";
                    onJoined(msg);
                    break;
                case "left": msg.userStatus = "left";
                    onLeft(msg);
                    break;
                case "camera":
                case "pointer": break;
                default: Logger.log(msg);
                    break;
            }

            //Determine what channel we are receiving the event on.
            //For example, a user list change can occur on either the collaboration channel (users in current session)
            //or on the presence channel (all users logged in), and the various GUI event handlers have to make decisions based
            //on that.
            var channelId = msg.roomId;

            //And send it to all listeners
            var evt = { type: MESSAGE_MAP[msg.type], data: msg, channelId: channelId };
            _this.dispatchEvent(evt);
        }

        function onJoined(evt) {
            if (!evt.user.name || !evt.user.name.length)
                evt.user.name = evt.user.id.slice(0, 5);

            if (evt.roomId) {
                var channel = _channels[evt.roomId];
                if (channel) {
                    channel.users.push(evt.user);
                    Logger.info(evt.user + " joined room " + evt.roomId);
                } else {
                    Logger.warn("Channel " + evt.roomId + " does not exist for socket " + _myID);
                }
            }
        }

        function onLeft(evt) {
            Logger.info(evt.user + " left room " + evt.room);
            for (var channelId in _channels) {
                var users = _channels[channelId].users;

                var idx = -1;
                for (var i = 0; i < users.length; i++) {
                    if (users[i].id == evt.user) {
                        idx = i;
                        break;
                    }
                }

                if (idx != -1)
                    users.splice(idx, 1);

                delete _channels[channelId].userSet[evt.user];
            }
        }

        function onJoinOK(evt) {

            var channel = _channels[evt.roomId];

            Logger.info("joined channel " + evt.roomId);

            if (evt.users && evt.users.length) {
                channel.users = evt.users;
            } else {
                channel.users = [];
            }

            for (var i = 0; i < channel.users.length; i++) {

                //Make up a user name if one is not known
                if (!channel.users[i].name || !channel.users[i].name.length) {
                    channel.users[i].name = channel.users[i].id.slice(0, 5);
                }
            }

            var name = getUserName();
            var you = Autodesk.Viewing.i18n.translate("you");
            var me = { id: _myID, name: name + " (" + you + ")", isSelf: true, status: 0 };
            if (!channel.userSet[_myID]) {
                channel.users.push(me);
                channel.userSet[_myID] = me;
            }

            //In case user name is already known, update the server.
            if (me.id.indexOf(name) != 0) {
                _this.sendChatMessage("/nick " + name, evt.roomId);
            }
        }


        function onChat(evt) {
            if (evt.msg.indexOf("/nick ") == 0) {
                var user = _this.getUserById(evt.from, evt.roomId);
                var newname = evt.msg.slice(6);

                if (newname.length) {
                    user.name = newname;
                    if (user.id == _myID) {
                        var you = Autodesk.Viewing.i18n.translate("you");
                        user.name += " (" + you + ")";
                    }
                }

                _this.dispatchEvent({ type: "userListChange", data: evt, channelId: evt.roomId });
            }
        }

        function onConnectError(evt) {

            //Attempt to connect to another server in case
            //the primary fails. If they all fail, then we give up.
            if (_currentServer < _serverURL.length) {

                Logger.info("Connect failed, trying another server...");

                _socket.disconnect();
                _socket = null;
                _currentServer++;
                _this.connect(_this.sessionID);

            } else {

                _this.dispatchEvent({ type: "socketError", data: evt });

            }
        }

        function onError(evt) {

            _this.dispatchEvent({ type: "socketError", data: evt });

        }

        function onConnect(evt) {
            _currentServer = 0;

            //Join any channels that were delayed while the
            //connection is established.
            for (var p in _pendingJoins) {
                _this.join(p);
            }
        }

        /**
         * Establish initial connection to the server specified when constructing the message client.
         */
        this.connect = function (sessionID) {

            //TODO: Maintain multiple sockets to the same server, identifier by sessionID.

            if (_socket)
                return; //already connected to socket server.

            if (typeof window.WebSocket !== "undefined") {

                if (!myio)
                    myio = (typeof lmv_io !== "undefined") ? lmv_io : io;

                this.sessionID = sessionID;

                _socket = myio.connect(_serverURL[_currentServer] + "?sessionID=" + sessionID, { path: serverPath, forceNew: true });
                _socket.on("connect", onConnect);
                _socket.on("message", onRecv);
                _socket.on("connect_error", onConnectError);
                _socket.on("error", onError);

                return true;
            }
            else {
                return false;
            }
        };

        /**
         * Subscribe to a messaging channel. Requires connection to be active (i.e. connect() called before join()).
         */
        this.join = function (channelId) {

            if (!_socket || !_socket.connected) {
                _pendingJoins[channelId] = 1;
                return;
            }

            delete _pendingJoins[channelId];

            _channels[channelId] = {
                id: channelId,
                users: [],
                userSet: {}
            };

            _socket.emit('join', { roomId: channelId, name: getUserName() });
        };

        /**
         * Disconnect from message server.
         */
        this.disconnect = function () {
            if (_socket) {
                _socket.disconnect();
                //_socket.close();
                _socket = null;
                _channels = {};
                _myID = null;
            }
        };


        /**
         * Send a message of a specific type, containing given data object to a channel.
         * Subscription (listening) to that channel is not required.
         */
        this.sendMessage = function (type, data, channelId) {

            var evt = { type: type, from: _myID, msg: data, roomId: channelId };

            _socket.emit("message", evt);
        };

        /**
         * Send a message object to an individual user.
         */
        this.sendPrivateMessage = function (targetId, msg) {

            var evt = { type: "private", target: targetId, from: _myID, msg: msg };

            _socket.emit("message", evt);
        };

        /**
         * A convenience wrapper of sendMessage to send a simple text chat message to a channel.
         */
        this.sendChatMessage = function (msg, channelId) {

            var evt = { type: "txt", from: _myID, msg: msg, roomId: channelId };

            _socket.emit("message", evt);

            //This is done to handle /nick commands
            onRecv(evt);
        };

        /**
         * Returns the user info object for a given user on a specific channel.
         * User lists are maintained per channel.
         */
        this.getUserById = function (id, channelId) {
            var users = _channels[channelId].users;
            for (var i = 0; i < users.length; i++) {
                if (users[i].id == id)
                    return users[i];
            }
            return null;
        };

        /**
         * Returns the local user's (randomly assigned) connection ID. Can be used to
         * maintain hashmaps of users, since it's unique per server.
         */
        this.getLocalId = function () { return _myID; };

        /**
         * Returns a channel's info object.
         */
        this.getChannelInfo = function (channelId) { return _channels[channelId]; };

        this.isConnected = function () { return _socket; };
    };

    MessageClient.prototype.constructor = MessageClient;
    EventDispatcher.prototype.apply(MessageClient.prototype);

    var _activeClients = {};

    MessageClient.GetInstance = function (serverUrls, path) {

        if (!serverUrls)
            serverUrls = Privite_Global.EnvironmentConfigurations[Privite_Global.env].LMV.RTC;

        if (!Array.isArray(serverUrls))
            serverUrls = [serverUrls];

        var mc = _activeClients[serverUrls[0]];
        if (mc)
            return mc;

        mc = new MessageClient(serverUrls, path);
        _activeClients[serverUrls[0]] = mc;
        return mc;
    };

    return MessageClient;
});