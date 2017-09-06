define(function() {
    'use strict';
    var EventDispatcher = function () {
    };


    EventDispatcher.prototype = {

        constructor: EventDispatcher,


        apply: function (object) {

            object.addEventListener = EventDispatcher.prototype.addEventListener;
            object.hasEventListener = EventDispatcher.prototype.hasEventListener;
            object.removeEventListener = EventDispatcher.prototype.removeEventListener;
            object.fireEvent = EventDispatcher.prototype.fireEvent;
            object.dispatchEvent = EventDispatcher.prototype.fireEvent;
        },

        /**
         * Adds an event listener.
         * @param {(string | type)} type
         * @param {function} listener
         */
        addEventListener: function (type, listener) {
            if (!type) return;
            if (this.listeners === undefined) this.listeners = {};

            if (typeof this.listeners[type] == "undefined") {
                this.listeners[type] = [];
            }

            this.listeners[type].push(listener);
        },

        /**
         * Returns true if the specified listener already exists, false otherwise.
         * @param {(string)} type
         * @param {function} listener
         */
        hasEventListener: function (type, listener) {

            if (!type) return false;
            if (this.listeners === undefined) return false;
            var listeners = this.listeners;
            if (listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1) {
                return true;
            }

            return false;
        },


        /**
         * @param {(string)} type
         * @param {function} listener
         */
        removeEventListener: function (type, listener) {
            if (!type) return;
            if (this.listeners === undefined) this.listeners = {};

            if (this.listeners[type] instanceof Array) {
                var li = this.listeners[type];
                for (var i = 0, len = li.length; i < len; i++) {
                    if (li[i] === listener) {
                        li.splice(i, 1);
                        break;
                    }
                }
            }
        },


        /**
         * @param {(string | type)} event
         */
        fireEvent: function (event) {
            if (this.listeners === undefined) this.listeners = {};

            if (typeof event == "string") {
                event = { type: event };
            }
            if (!event.target) {
                try {
                    event.target = this;
                } catch (e) { }
            }

            if (!event.type) {
                throw new Error("event type unknown.");
            }

            if (this.listeners[event.type] instanceof Array) {
                var typeListeners = this.listeners[event.type].slice();
                for (var i = 0; i < typeListeners.length; i++) {
                    typeListeners[i].call(this, event);
                }
            }
        }

    };

    return EventDispatcher;
});