define([
    '../Constants/EventType',
    '../Logger'
], function(EventType, Logger) {
    'use strict';
    /**
     * Application preferences. Optionally uses web storage.
     * @constructor
     * @param {Viewer} viewer - Viewer instance
     * @param {string} prefix - A string to prefix preference names in web storage
     */
    var Preferences = function (viewer, prefix) {
        if (!prefix) {
            prefix = 'Autodesk.Viewing.Preferences.';
        }


        // from stackoverflow:
        // http://stackoverflow.com/questions/14555347/html5-localstorage-error-with-safari-quota-exceeded-err-dom-exception-22-an
        //
        function isLocalStorageSupported() {
            var testKey = prefix + 'test';
            try {
                var storage = window.localStorage; // This may assert if browsers disallow sites from setting data.
                storage.setItem(testKey, '1');
                storage.removeItem(testKey);
                return true;

            } catch (error) {
                return false;
            }
        }

        var defaults = {}, // Default values
            callbacks = {}, // Changed and Reset listeners
            tags = {},
            useLocalStorage = isLocalStorageSupported(),
            that = this;

        // TODO: callbacks should be array, not single
        // Would need to deal with issue of registering same callback twice
        //
        viewer.addEventListener(EventType.PREF_CHANGED_EVENT, function (event) {
            var callbacksForName = callbacks[event.name];
            if (callbacksForName) {
                var callback = callbacksForName.changed;
                if (callback) {
                    callback(event.value);
                }
            }
        });

        viewer.addEventListener(EventType.PREF_RESET_EVENT, function (event) {
            for (var name in callbacks) {
                if (callbacks.hasOwnProperty(name)) {
                    var callback = callbacks[name].reset;
                    if (callback) {
                        callback(that[name]);
                    }
                }
            }
        });

        /**
         * Get/set preference value in web storage.
         * @param {string} name - Preference name
         * @param {*=} [value] - Preference value
         * @returns {*} Preference value or undefined if not available
         * @private
         */
        function webStorage(name, value) {
            if (useLocalStorage) {

                // Prefix our names, so we don't pollute the localStorage of the embedding application
                name = prefix + name;

                if (typeof (value) !== "undefined") {
                    // If value is specified, we set this value at localStorage[name]
                    localStorage[name] = value;

                } else {
                    // If no value is specified we return the value at localStorage[name]
                    value = localStorage[name];
                }
                return value;
            }
            return undefined;
        }

        /**
         * Adds a preference name + default value, tries to load value from web storage.
         * @param {string} name
         * @param defaultValue
         * @private
         */
        function addPref(name, defaultValue) {
            if (typeof name !== 'string' || typeof that[name] === 'function') {
                Logger.log('Preferences: invalid name=' + name);
                return;
            }

            // Use default if nothing in web storage.
            //
            var value = webStorage(name);
            var ok = false;

            if (value !== undefined) {
                try {
                    value = JSON.parse(value);
                    ok = true;
                } catch (e) {
                }
            }
            that[name] = ok ? value : defaultValue;
            tags[name] = {};
        }

        /**
         * Load preference values from web storage/defaults.
         * @param {Object} defaultValues - Preference names and their default values
         */
        this.load = function (defaultValues) {
            defaults = defaultValues;
            for (var name in defaults) {
                if (defaults.hasOwnProperty(name)) {
                    addPref(name, defaults[name]);
                }
            }
        };

        /**
         * Adds a tag to the specified preferences.
         * These are used by reset().
         * @param {string} tag
         * @param {Array.<string>|string} [names] - Preference names, default all preferences
         */
        this.tag = function (tag, names) {
            if (tag) {
                if (!names) {
                    names = Object.keys(defaults);
                } else if (!Array.isArray(names)) {
                    names = [names];
                }
                for (var i = 0; i < names.length; ++i) {
                    tags[names[i]][tag] = true;
                }
            }
        };

        /**
         * Removes a tag from the specified preferences.
         * These are used by reset().
         * @param {string} tag
         * @param {Array.<string>|string} [names] - Preference names, default all preferences
         */
        this.untag = function (tag, names) {
            if (tag) {
                if (!names) {
                    names = Object.keys(defaults);
                } else if (!Array.isArray(names)) {
                    names = [names];
                }
                for (var i = 0; i < names.length; ++i) {
                    tags[names[i]][tag] = false;
                }
            }
        };

        /**
         * Adds a new preference name + default value.
         * This preference was not previously loaded via load().
         * @param {string} name - Preference name
         * @param defaultValue - Preference default value
         * @param {Array.<string>|string} [tags] - Optional tags
         * @returns {boolean} true if the preference was added
         */
        this.add = function (name, defaultValue, tags) {
            if (defaults.hasOwnProperty(name)) {
                Logger.log("Preferences: " + name + " already exists");

            } else {
                defaults[name] = defaultValue;
                addPref(name, defaultValue);

                if (tags) {
                    if (!Array.isArray(tags)) {
                        tags = [tags];
                    }
                    for (var i = 0; i < tags.length; ++i) {
                        this.tag(tags[i], name);
                    }
                }
                return true;
            }
            return false;
        };

        /**
         * Removes an existing preference.
         * @param {string} name - Preference name
         * @param {boolean} [removeFromWebStorage=false] - true to clear the web storage entry for this preference
         * @returns {boolean} true if the preference was removed
         */
        this.remove = function (name, removeFromWebStorage) {
            if (defaults.hasOwnProperty(name)) {
                delete defaults[name];
                delete tags[name];
                delete this[name];

                if (removeFromWebStorage && useLocalStorage) {
                    name = prefix + name;
                    delete localStorage[name];
                }

                return true;
            }
            return false;
        };

        /**
         * Reset preferences to default values.
         * If a tag is specified, then only certain preferences are reset.
         * @param {string=} [tag] Optional tag
         * @param {boolean=} [include=true] true to reset only preferences with matching tags
         */
        this.reset = function (tag, include) {
            if (tag && include === undefined) {
                include = true;
            }

            for (var name in defaults) {
                if (defaults.hasOwnProperty(name)) {
                    if (tag) {
                        var tagged = !!tags[name][tag];
                        if ((include && !tagged) || (!include && tagged)) {
                            continue;
                        }
                    }

                    if (this.set(name, defaults[name], false)) {
                        viewer.fireEvent({
                            type: EventType.PREF_RESET_EVENT,
                            name: name,
                            value: this[name]
                        });
                    }
                }
            }
        };

        /**
         * Get named preference value.
         * Shortcut: prefs[name]
         * @returns {*} Preference value
         */
        this.get = function (name) {
            return this[name];
        };

        /**
         * Set named preference value.
         * Do not use shortcut prefs[name] = value
         * @param {string} name - Preference name
         * @param {*} value - Preference value
         * @param {boolean=} [notify=true] - If true then av.PREF_CHANGED_EVENT is fired.
         * @returns {boolean} true if the value changed, false otherwise
         */
        this.set = function (name, value, notify) {
            // Updates the cached value as well as the value in the web storage
            if (this[name] !== value) {
                this[name] = value;
                webStorage(name, value);

                if (notify === undefined || notify) {
                    viewer.fireEvent({
                        type: EventType.PREF_CHANGED_EVENT,
                        name: name,
                        value: value
                    });
                }

                Logger.track({ category: "pref_changed", name: name, value: value });

                return true;
            }
            return false;
        };

        /**
         * Listen for preference changed and reset events.
         * @param {string} name - Preferences name
         * @param {function(*)} onChangedCallback - Function called when preferences are changed
         * @param {function(*)} onResetCallback - Function called when preferences are reset
         */
        this.addListeners = function (name, onChangedCallback, onResetCallback) {
            callbacks[name] = { changed: onChangedCallback, reset: onResetCallback };
        };

        /**
         * Remove listeners for preference changed and reset events.
         * @param {string} name - Preferences name
         */
        this.removeListeners = function (name) {
            if (callbacks[name] !== undefined) {
                delete callbacks[name];
            }
        };
    };

    return Preferences;
});