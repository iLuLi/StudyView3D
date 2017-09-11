define(function() {;
    'use strict'

    var DomUtils = {};
    function DomDispatcher() { }
    DomUtils.DomDispatcher = DomDispatcher;

    DomDispatcher.prototype = {
        constructor: DomDispatcher,
        apply: function (object) {
            object.hookEvent = DomDispatcher.prototype.hookEvent;
            object.unhookEvents = DomDispatcher.prototype.unhookEvents;
            object.eventsHooked = [];
        },
        hookEvent: function (domElem, eventStr, selector, callbackFn) {
            var handler = function (event) {
                var node = avp.DomUtils.seekSelectorUp(event.target, selector);
                node && callbackFn(event, node);
            };
            domElem.addEventListener(eventStr, handler);
            this.eventsHooked.push({
                domElem: domElem,
                eventStr: eventStr,
                callback: handler
            });
        },
        unhookEvents: function () {
            this.eventsHooked.forEach(function (data) {
                data.domElem.removeEventListener(data.eventStr, data.callback);
            });
            this.eventsHooked.length = 0;
        }
    }


    DomUtils.seekSelectorUp = function (child, selector) {
        while (child) {
            if (avp.DomUtils.matchesSelector(child, selector)) {
                return child;
            } else {
                child = child.parentNode;
            }
        }
        return child;
    }

    DomUtils.matchesSelector = function (domElem, selector) {
        if (domElem.matches) return domElem.matches(selector); //Un-prefixed
        if (domElem.msMatchesSelector) return domElem.msMatchesSelector(selector);  //IE
        if (domElem.mozMatchesSelector) return domElem.mozMatchesSelector(selector); //Firefox (Gecko)
        if (domElem.webkitMatchesSelector) return domElem.webkitMatchesSelector(selector); // Opera, Safari, Chrome
        return false;
    };

    DomUtils.removeChildren = function (domElem) {
        domElem.innerHTML = '';
    };

    DomUtils.remove = function (domElem) {
        if (domElem && domElem.parentNode) {
            domElem.parentNode.removeChild(domElem);
        }
    };

    return DomUtils;
});