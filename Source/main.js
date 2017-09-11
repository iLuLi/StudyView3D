require([
    './HY'
], function(
    HY) {
'use strict';
/*global self*/
var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};

scope.HY = HY;
}, undefined, true);