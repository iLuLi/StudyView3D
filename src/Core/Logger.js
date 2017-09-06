define(['./LogLevels',
        './Privite/Global',
        "./DeviceType"
       ], function(
        LogLevels,
        Privite_Global,
        DeviceType
) {
    'use strict'
    /**
     * Logging levels. Higher number means more verbose logs,
     * for example, with level 3, `info`, `warn`, or `error`
     * logs will show up in the console but `debug` and `log` won't.
     *
     * Semantics of specific levels:
     *  - debug: low-level debugging logs
     *  - log: common, higher-level debugging logs
     *  - info: helpful runtime information (even for stag/prod environments)
     *  - warn: potentially problematic situations; handled exceptions
     *  - error: definitely problematic situations; unhandled exceptions
     * @readonly
     * @enum {number}
     */

    function Logger() {
        this.adp = null;
        this.runtimeStats = {};
        this.level = -1;
        this.setLevel(Privite_Global.ENABLE_TRACE ? LogLevels.DEBUG : LogLevels.ERROR);
    }

    Logger.prototype.initialize = function (options) {
        
        if (options.eventCallback)
            this.callback = options.eventCallback;

        this.sessionId = options.sessionId;
        if (!this.sessionId) {
            var now = Date.now() + "";
            this.sessionId = parseFloat(((Math.random() * 10000) | 0) + "" + now.substring(4));
        }

        this.environmentInfo = {
            touch: DeviceType.isTouchDevice,
            env: Privite_Global.env,
            referer: getReferer(),
            version: Privite_Global.LMV_VIEWER_VERSION,
            patch: Privite_Global.LMV_VIEWER_PATCH,
            build_type: Privite_Global.LMV_BUILD_TYPE
        };

        //Kick off with a viewer start event
        var startEvent = {
            category: "viewer_start",
            touch: this.environmentInfo.touch,
            env: this.environmentInfo.env,
            referer: this.environmentInfo.referer,
            version: this.environmentInfo.version,
            patch: this.environmentInfo.patch,
            build_type: this.environmentInfo.build_type
        };
        this.track(startEvent);

        var _this = this;
        setInterval(function () {
            _this.reportRuntimeStats();
        }, 60000);
    };

    Logger.prototype.track = function (entry) {
        this.updateRuntimeStats(entry);

        if (Privite_Global.offline || !this.sessionId) {
            return;
        }

        entry.timestamp = Date.now();
        entry.sessionId = this.sessionId;

        var sent = this.logToADP(entry);

        if (this.callback) {
            this.callback(entry, {
                adp: sent
            });
        }
    };

    Logger.prototype.logToADP = function (entry) {
        if (!this.adp) {
            return false;
        }

        // Map & log legacy events to ADP
        // TODO: move away from the legacy naming and avoid the awkward switch below
        var evType = '';
        var opType = '';
        switch (entry.category) {
            case 'tool_changed':
            case 'pref_changed':
                evType = 'CLICK_OPERATION';
                opType = entry.category + '/' + entry.name;
                break;
            case 'screen_mode':
                evType = 'CLICK_OPERATION';
                opType = 'pref_changed/' + entry.category;
                break;
            case 'metadata_load_stats':
                evType = 'DOCUMENT_START';
                opType = 'stats';
                entry.full_url = getReferer();
                break;
            case 'model_load_stats':
                evType = 'DOCUMENT_FULL';
                opType = 'stats';
                break;
            case 'error':
                evType = 'BACKGROUND_CALL';
                opType = 'error';
                break;
        }

        if (!evType)
            return false;

        this.adp.trackEvent(evType, {
            operation: {
                id: entry.sessionId,
                type: opType,
                stage: '',
                status: 'C',
                meta: entry
            }
        });
        return true;
    };

    Logger.prototype.updateRuntimeStats = function (entry) {
        if (entry.hasOwnProperty('aggregate')) {
            switch (entry.aggregate) {
                case 'count':
                    if (this.runtimeStats[entry.name] > 0) {
                        this.runtimeStats[entry.name]++;
                    } else {
                        this.runtimeStats[entry.name] = 1;
                    }
                    this.runtimeStats._nonempty = true;
                    break;
                case 'last':
                    this.runtimeStats[entry.name] = entry.value;
                    this.runtimeStats._nonempty = true;
                    break;
                default:
                    this.warn('unknown log aggregate type');
            }
        }
    };

    Logger.prototype.reportRuntimeStats = function () {
        if (this.runtimeStats._nonempty) {
            delete this.runtimeStats._nonempty;

            if (this.adp) {
                this.adp.trackEvent('BACKGROUND_CALL', {
                    operation: {
                        id: this.sessionId,
                        type: 'stats',
                        stage: '',
                        status: 'C',
                        meta: this.runtimeStats
                    }
                });
            }

            this.runtimeStats.category = 'misc_stats';
            this.track(this.runtimeStats);
            this.runtimeStats = {};
        }
    };

    Logger.prototype.setLevel = function (level) {
        if (this.level === level)
            return;

        this.level = level;

        var nullFn = function () { };
        var avpl = LogLevels;

        // Bind to console
        this.debug = level >= avpl.DEBUG ? console.log.bind(console) : nullFn;
        this.log = level >= avpl.LOG ? console.log.bind(console) : nullFn;
        this.info = level >= avpl.INFO ? console.info.bind(console) : nullFn;
        this.warn = level >= avpl.WARNING ? console.warn.bind(console) : nullFn;
        this.error = level >= avpl.ERROR ? console.error.bind(console) : nullFn;
    };

    /**
     * @private
     */
    function getReferer() {
        // Wrapping href retrieval due to Fortify complains
        if (typeof window !== 'undefined') {
            return encodeURI(window.location.href);
        }
        return '';
    }

    return new Logger();
});