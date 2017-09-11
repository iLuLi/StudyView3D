define(function() {;
    'use strict'
    // Convert touchstart event to click to remove the delay between the touch and
    // the click event which is sent after touchstart with about 300ms deley.
    // Should be used in UI elements on touch devices.
    var touchStartToClick = function (e) {
        e.preventDefault();  // Stops the firing of delayed click event.
        e.stopPropagation();
        e.target.click();    // Maps to immediate click.
    };

    return touchStartToClick;
});