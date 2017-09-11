define( function() {
    'use strict';
    var ProgressBar = function (container) {
        
        this.bg = document.createElement('div');
        this.bg.className = 'progressbg';

        this.fg = document.createElement('div');
        this.fg.className = 'progressfg';
        this.bg.appendChild(this.fg);
        this.lastValue = -1;

        container.appendChild(this.bg);

        this.widthScale = this.fg.clientWidth;
    };

    ProgressBar.prototype.setPercent = function (pct) {

        if (pct == this.lastValue)
            return;

        this.lastValue = pct;

        if (pct >= 99)
            this.bg.style.visibility = "hidden";
        else {
            this.bg.style.visibility = "visible";
            this.fg.style.width = (this.widthScale * pct * 0.01) + "px";
        }
    };

    return ProgressBar;
});