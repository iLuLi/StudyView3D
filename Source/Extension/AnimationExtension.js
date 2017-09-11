define([
    './Extension',
    '../UI/Base/ToolbarSID',
    '../Core/Constants/EventType',
    '../Core/Constants/DeviceType',
    '../UI/Base/ToolBar',
    '../UI/Base/Control',
    '../UI/Base/ControlGroup',
    '../UI/Base/Button',
    '../Core/Manager/theExtensionManager'
], function(Extension, ToolbarSID, EventType, DeviceType, ToolBar, Control, ControlGroup, Button, theExtensionManager ) {
    'use strict';
    /**
     * AnimationExtension adds a toolbar with buttons (play/pause/forward/backward/goto start/end)
     * and timeline scrubber to control animation playback.
     */
    var AnimationExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
        this.viewer = viewer;
        this.animTools = null;
        this.animToolsId = "animationTools";
        this.playButton = null;
        this.prevAnimationTime = -1;
    };

    AnimationExtension.prototype = Object.create(Extension.prototype);
    AnimationExtension.prototype.constructor = AnimationExtension;

    /**
     * Converts seconds into Hours:Minutes:Seconds String
     * @param {Number} time in seconds
     * @returns {string}
     * @private
     */
    function convertSecsToHMS(time) {
        var sign = "";
        if (time < 0) { sign = "-"; time = -time; }
        var hrs = ~~(time / 3600);
        var mins = ~~((time % 3600) / 60);
        var secs = time % 60;
        var ret = sign;
        if (hrs > 0)
            ret += hrs + ":" + (mins < 10 ? "0" : "");
        ret += mins + ":" + (secs < 10 ? "0" : "");
        ret += secs.toFixed(2);
        return ret;
    }

    AnimationExtension.prototype.load = function () {
        var viewer = this.viewer;

        this.onPlayCallbackBinded = this.onPlayCallback.bind(this);
        this.onCameraChangeBinded = this.onCameraChange.bind(this);
        this.onExplodeBinded = this.onExplode.bind(this);
        this.onResizeBinded = this.onResize.bind(this);
        this.onEscapeBinded = this.onEscape.bind(this);

        viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        viewer.addEventListener(Autodesk.Viewing.EXPLODE_CHANGE_EVENT, this.onExplodeBinded);
        viewer.addEventListener(Autodesk.Viewing.VIEWER_RESIZE_EVENT, this.onResizeBinded);
        viewer.addEventListener(Autodesk.Viewing.ESCAPE_EVENT, this.onEscapeBinded);

        // init animations after object tree created and geometry loaded
        if (viewer.model && viewer.model.isObjectTreeCreated()) {
            this.onAnimationReady();
        } else {
            this.onAnimationReadyBinded = this.onAnimationReady.bind(this);
            viewer.addEventListener(Autodesk.Viewing.ANIMATION_READY_EVENT, this.onAnimationReadyBinded);
        }

        return true;
    };

    AnimationExtension.prototype.unload = function () {
        var viewer = this.viewer;

        if (this.onAnimationReadyBinded) {
            viewer.removeEventListener(Autodesk.Viewing.ANIMATION_READY_EVENT, this.onAnimationReadyBinded);
            this.onAnimationReadyBinded = null;
        }

        // stop animations
        this.rewind();
        viewer.impl.invalidate(true, true, true); // Required to reset animations when Extension unloads and viewer remains.

        this.onPlayCallbackBinded = null;

        if (this.animTools) {
            this.animTools.removeControl(this.animTools.timeText.getId());
            this.animTools.removeControl(this.animTools.timeline.getId());
            this.animTools.removeControl(this.animTools.timeLeftText.getId());
            this.animTools.removeControl(this.animTools.forwardButton.getId());
            this.animTools.removeControl(this.animTools.backwardButton.getId());
            this.animTools.removeControl(this.animTools.closeButton.getId());
        }

        if (this.toolbar) {
            this.toolbar.removeControl(this.animTools);
            this.toolbar.container.parentNode.removeChild(this.toolbar.container);
            this.toolbar = null;
        }

        if (this.playButton) {
            var toolbar = viewer.getToolbar(false);
            if (toolbar) {
                toolbar.getControl(ToolbarSID.MODELTOOLSID).removeControl(this.playButton.getId());
            }
        }

        // Remove event listeners
        viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, this.onCameraChangeBinded);
        viewer.removeEventListener(EventType.EXPLODE_CHANGE_EVENT, this.onExplodeBinded);
        viewer.removeEventListener(EventType.VIEWER_RESIZE_EVENT, this.onResizeBinded);
        viewer.removeEventListener(EventType.ESCAPE_EVENT, this.onEscapeBinded);

        if (this.onToolbarCreatedBinded) {
            viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
            this.onToolbarCreatedBinded = null;
        }

        return true;
    };

    /**
     * Plays the animation. Invoke pause() to stop the animation.
     */
    AnimationExtension.prototype.play = function () {

        if (this.isPlaying()) {
            return;
        }

        this.resetExplode(0, true);

        var viewer = this.viewer;
        var animator = viewer.impl.keyFrameAnimator;
        if (!animator) return;

        // restore previous animation if set
        if (this.prevAnimationTime > 0) {
            animator.goto(this.prevAnimationTime);
            this.prevAnimationTime = -1;
        }

        animator.play(0, this.onPlayCallbackBinded);

        this.updatePlayButton(animator.isPaused);
        if (viewer.toolbar) {
            viewer.toolbar.addClass('toolbar-animationMenuplacer');
        }
        if (this.animTools) {
            this.animTools.setVisible(true);
            if (!this.animTools.isPositionAdjusted) {
                this.adjustToolbarPosition();
                this.animTools.isPositionAdjusted = true;
            }
        }
    };

    /**
     * Pauses an active animation. Can resume by calling play()
     */
    AnimationExtension.prototype.pause = function () {

        if (this.isPaused()) {
            return;
        }

        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return;
        animator.pause();

        // UI stuff
        this.updatePlayButton(animator.isPaused);
    };

    /**
     * Whether the animation is currently playing.
     * Always returns the opposite of isPaused()
     * @returns {Boolean}
     */
    AnimationExtension.prototype.isPlaying = function () {

        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return false;
        return animator.isPlaying && !animator.isPaused;
    };

    /**
     * Wether the animation is currently paused.
     * Always returns the opposite of isPlaying()
     * @returns {Boolean}
     */
    AnimationExtension.prototype.isPaused = function () {

        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return false;
        return animator.isPaused;
    };

    /**
     * Pauses and rewinds the animation.
     */
    AnimationExtension.prototype.rewind = function () {
        this.setTimelineValue(0);
    };

    /**
     * Sets the animation at the very beginning (0), at the end(1) or anywhere in between.
     * For example, use value 0.5 to set the animation half way through it's completion.
     * Will pause a playing animation.
     *
     * @param {Number} scale - value between 0 and 1
     */
    AnimationExtension.prototype.setTimelineValue = function (scale) {
        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return;
        scale = Math.min(Math.max(0, scale), 1);
        var time = scale * animator.duration;
        animator.goto(time);
        this.updateUI();
    };

    /**
     * Sets animation onto the previous keyframe.
     * Will pause the animation if playing.
     */
    AnimationExtension.prototype.prevKeyframe = function () {
        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return;
        animator.prev();
        this.updateUI();
    };

    /**
     * Sets animation onto the next keyframe.
     * Will pause the animation if playing.
     */
    AnimationExtension.prototype.nextKeyframe = function () {
        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return;
        animator.next();
        this.updateUI();
    };

    /**
     * Returns how many seconds does the animation take to complete.
     * See also:
     * - getDurationLabel()
     * - getCurrentTime()
     * @return {Number}
     */
    AnimationExtension.prototype.getDuration = function () {
        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return 0;
        return animator.duration;
    };

    /**
     * Returns duration as a formatted String h:mm:ss (hours:minutes:seconds)
     * See also:
     * - getDuration()
     * - getCurrentTimeLabel()
     * @returns {string}
     */
    AnimationExtension.prototype.getDurationLabel = function () {
        return convertSecsToHMS(this.getDuration());
    };

    /**
     * Returns the elapsed time (in seconds) of the animation.
     * See also:
     * - getDuration()
     * - getCurrentTimeLabel()
     * @return {Number}
     */
    AnimationExtension.prototype.getCurrentTime = function () {
        var animator = this.viewer.impl.keyFrameAnimator;
        if (!animator) return 0;
        return animator.currentTime;
    };

    /**
     * Returns the current animation time as a formatted String h:mm:ss (hours:minutes:seconds)
     * See also:
     * - getCurrentTime()
     * - getDurationLabel()
     * @returns {string}
     */
    AnimationExtension.prototype.getCurrentTimeLabel = function () {
        return convertSecsToHMS(this.getCurrentTime());
    };



    /**
     * @private
     */
    AnimationExtension.prototype.onAnimationReady = function () {
        var viewer = this.viewer;

        if (this.onAnimationReadyBinded) {
            viewer.removeEventListener(Autodesk.Viewing.ANIMATION_READY_EVENT, this.onAnimationReadyBinded);
            this.onAnimationReadyBinded = null;
        }

        // Check for animator class
        if (!viewer.impl.keyFrameAnimator)
            return;

        // Add the ui only if an animation is available.
        if (viewer.toolbar && viewer.modelTools) {
            this.onToolbarCreated();
        } else {
            this.onToolbarCreatedBinded = this.onToolbarCreated.bind(this);
            viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
        }
    };

    /**
     *
     * @private
     */
    AnimationExtension.prototype.updateUI = function () {

        var animator = this.viewer.impl.keyFrameAnimator;
        if (!this.animTools || !animator) {
            return;
        }
        this.animTools.input.value = animator.duration > 0 ? animator.currentTime / animator.duration * 100 : 0;
        this.animTools.lapse.value = convertSecsToHMS(animator.currentTime);
        this.animTools.lapseLeft.value = convertSecsToHMS(animator.currentTime - animator.duration);
        this.updatePlayButton(animator.isPaused);
        this.updateToolbarBackground();
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onPlayCallback = function (value) {

        // TODO: We should be able to replace this whole method body with a call to update().
        // The only problem for now is taht we would also need to change KeyFrameAnimator because
        // the onPlayCallback() is being invoked BEFORE the animation is paused.
        if (!this.animTools) return;

        var animator = this.viewer.impl.keyFrameAnimator;
        this.animTools.input.value = value;
        this.animTools.lapse.value = convertSecsToHMS(animator.currentTime);
        this.animTools.lapseLeft.value = convertSecsToHMS(animator.currentTime - animator.duration);

        if (value >= 100) {
            this.updatePlayButton(true);
        }
        this.updateToolbarBackground();
    };

    /**
     *
     * @param isPaused
     * @private
     */
    AnimationExtension.prototype.updatePlayButton = function (isPaused) {
        if (!this.playButton) return;
        if (isPaused) {
            this.playButton.setIcon('toolbar-animationPlayIcon');
            this.playButton.setToolTip('Play');
        } else {
            this.playButton.setIcon('toolbar-animationPauseIcon');
            this.playButton.setToolTip('Pause');
        }
    };

    /**
     * Helper function that resets model explosion.
     * @param value
     * @param setSlider
     * @private
     */
    AnimationExtension.prototype.resetExplode = function (value, setSlider) {
        var viewer = this.viewer;
        if (!viewer.model.is2d() && viewer.getExplodeScale() !== 0) {
            if (setSlider && viewer.explodeSlider) { // explodeSlider is only in GuiViewer3D instances
                viewer.explodeSlider.value = value;
            }
            viewer.explode(value);
        }
    };

    /**
     * @private
     */
    AnimationExtension.prototype.adjustToolbarPosition = function () {
        // set timeline width
        var viewer = this.viewer;
        if (!viewer.toolbar) return;
        var fullwidth = viewer.toolbar.getDimensions().width;
        var viewportWidth = viewer.container.getBoundingClientRect().width;
        if (fullwidth > viewportWidth)
            fullwidth = viewer.modelTools.getDimensions().width;
        var inputWidth = fullwidth - (2 *
            this.animTools.backwardButton.getDimensions().width + 3 *
            this.animTools.timeText.getDimensions().width + this.animTools.closeButton.getDimensions().width) + 12;
        this.animTools.input.style.width = inputWidth + 'px';

        // center toolbar
        this.toolbar.container.style.left = 'calc(50% - ' + fullwidth / 2 + 'px)';
    };

    /**
     * @private
     */
    AnimationExtension.prototype.hideAnimateToolbar = function () {
        if (this.viewer.toolbar) {
            this.viewer.toolbar.removeClass('toolbar-animationMenuplacer');
        }
        if (this.animTools) {
            this.animTools.setVisible(false);
        }
    };

    /**
     * @private
     */
    AnimationExtension.prototype.updateToolbarBackground = function () {
        if (!this.animTools) return;
        var input = this.animTools.input;
        var percentage = input.value;
        var col1 = "#ffffff", col2 = "#393939";
        input.style.background = "-webkit-linear-gradient(left," + col1 + " " + percentage + "%, " + col2 + " " + percentage + "%)";
        input.style.background = "-moz-linear-gradient(left," + col1 + " " + percentage + "%, " + col2 + " " + percentage + "%)";
        input.style.background = "-ms-linear-gradient(left," + col1 + " " + percentage + "%, " + col2 + " " + percentage + "%)";
        input.style.background = "-o-linear-gradient(left," + col1 + " " + percentage + "%, " + col2 + " " + percentage + "%)";
        input.style.background = "linear-gradient(to right," + col1 + " " + percentage + "%, " + col2 + " " + percentage + "%)";
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onCameraChange = function () {
        if (this.viewer.toolController.cameraUpdated) {
            var animator = this.viewer.impl.keyFrameAnimator;
            if (!animator) return;
            if (animator.isPlaying && !animator.isPaused) {
                animator.pause();
                this.updatePlayButton(animator.isPaused);
            }
        }
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onResize = function () {
        if (!this.toolbar) return;
        if (this.viewer.container.clientWidth < (DeviceType.isTouchDevice ? 560 : 600)) {
            this.toolbar.setCollapsed(true);
        } else {
            this.toolbar.setCollapsed(false);
            this.adjustToolbarPosition();
        }
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onEscape = function () {

        if (this.isPlaying()) {
            this.pause();
        } else {
            this.hideAnimateToolbar();
        }
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onExplode = function () {
        // reset animation
        var animator = this.viewer.impl.keyFrameAnimator;
        if (animator) {
            if (animator.currentTime !== 0) {
                this.prevAnimationTime = animator.currentTime;
                animator.goto(0);
            }
            this.updatePlayButton(true);
        }
        this.hideAnimateToolbar();
    };

    /**
     * @private
     */
    AnimationExtension.prototype.onToolbarCreated = function () {

        var viewer = this.viewer;
        var that = this;

        if (this.onToolbarCreatedBinded) {
            viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
            this.onToolbarCreatedBinded = null;
        }

        this.toolbar = new ToolBar('animation-toolbar');
        this.toolbar.addClass('toolbar-animationSubtoolbar');
        viewer.container.appendChild(this.toolbar.container);

        this.animTools = new ControlGroup(this.animToolsId);
        this.animTools.setVisible(false);
        this.toolbar.addControl(this.animTools);

        // play button at first of modelTools
        this.playButton = new Button('toolbar-animationPlay');
        this.playButton.setIcon('toolbar-animationPlayIcon');
        this.playButton.setToolTip('Play');
        this.playButton.onClick = function () {
            if (that.isPaused()) {
                that.play();
            } else {
                that.pause();
            }
        };
        viewer.modelTools.addControl(this.playButton);

        // override reset button's onClick method
        if (viewer.modelTools.resetModelButton) {
            viewer.modelTools.resetModelButton.onClick = function (e) {
                viewer.showAll();
                var animator = viewer.impl.keyFrameAnimator;
                if (animator) {
                    animator.goto(0);
                    input.value = 0;
                    lapse.value = convertSecsToHMS(0);
                    lapseLeft.value = convertSecsToHMS(-animator.duration);
                    that.updatePlayButton(true);
                }
                that.resetExplode(0, true);
                that.updateToolbarBackground();
            };
        }

        // backward button
        this.animTools.backwardButton = new Button('toolbar-animationBackward');
        this.animTools.backwardButton.setToolTip('Previous keyframe');
        this.animTools.backwardButton.onClick = function (e) {
            var animator = viewer.impl.keyFrameAnimator;
            if (animator !== undefined && animator) {
                animator.prev();
                that.updateUI();
            }
        };
        this.animTools.backwardButton.addClass('toolbar-animationButton');
        this.animTools.backwardButton.setIcon('toolbar-animationBackwardIcon');
        this.animTools.addControl(this.animTools.backwardButton);

        // forward button
        this.animTools.forwardButton = new Button('toolbar-animationForward');
        this.animTools.forwardButton.setToolTip('Next keyframe');
        this.animTools.forwardButton.onClick = function (e) {
            var animator = viewer.impl.keyFrameAnimator;
            if (animator !== undefined && animator) {
                animator.next();
                that.updateUI();
            }
        };
        this.animTools.forwardButton.addClass('toolbar-animationButton');
        this.animTools.forwardButton.setIcon('toolbar-animationForwardIcon');
        this.animTools.addControl(this.animTools.forwardButton);

        // current time lapse
        this.animTools.timeText = new Control('toolbar-animationTimeLapse');
        var lapse = this.animTools.lapse = document.createElement("input");
        lapse.type = "text";
        lapse.value = "0";
        lapse.className = "animationTimeLapse";
        lapse.disabled = true;
        this.animTools.timeText.container.appendChild(lapse);
        this.animTools.timeText.addClass('toolbar-animationButton');
        this.animTools.addControl(this.animTools.timeText);

        // timeline
        this.animTools.timeline = new Control('toolbar-animationTimeline');
        var input = this.animTools.input = document.createElement("input");
        input.type = "range";
        input.value = "0";
        input.className = "animationTimeline";
        this.animTools.timeline.container.appendChild(input);
        input.addEventListener("input", function (e) {
            var animator = viewer.impl.keyFrameAnimator;
            if (animator !== undefined && animator) {
                var time = input.value * animator.duration / 100;
                lapse.value = convertSecsToHMS(time);
                lapseLeft.value = convertSecsToHMS(time - animator.duration);
                animator.goto(time);
                that.updatePlayButton(animator.isPaused);
                that.updateToolbarBackground();
            }
        });
        // tooltip for slider
        var inputTooltip = document.createElement("div");
        inputTooltip.className = "adsk-control-tooltip";
        inputTooltip.textContent = Autodesk.Viewing.i18n.translate("Click-drag to scrub");
        this.animTools.timeline.container.appendChild(inputTooltip);
        input.addEventListener("mouseover", function (event) {
            if (event.target === input)
                inputTooltip.style.visibility = "visible";
        });
        input.addEventListener("mouseout", function (event) {
            if (event.target === input)
                inputTooltip.style.visibility = "hidden";
        });

        this.animTools.timeline.addClass('toolbar-animationButton');
        this.animTools.timeline.addClass('toolbar-animationTimeline');
        this.animTools.addControl(this.animTools.timeline);

        // remaining time lapse
        this.animTools.timeLeftText = new Control('toolbar-animationRemainingTime');
        var lapseLeft = this.animTools.lapseLeft = document.createElement("input");
        lapseLeft.type = "text";
        lapseLeft.value = "0";
        lapseLeft.className = "animationTimeLapse";
        lapseLeft.disabled = true;
        this.animTools.timeLeftText.container.appendChild(lapseLeft);
        this.animTools.timeLeftText.addClass('toolbar-animationButton');
        this.animTools.addControl(this.animTools.timeLeftText);

        // close button
        this.animTools.closeButton = new Button('toolbar-animationClose');
        this.animTools.closeButton.setToolTip('Close animation timeline');
        this.animTools.closeButton.onClick = function () {
            that.hideAnimateToolbar();
        };
        this.animTools.closeButton.setIcon('toolbar-animationCloseIcon');
        this.animTools.closeButton.addClass('toolbar-animationButton');
        this.animTools.addControl(this.animTools.closeButton);
    };

    //TODO: Is it really necessary to expose it other than to ExtensionManager?

    theExtensionManager.registerExtension('Autodesk.Fusion360.Animation', AnimationExtension);

    return AnimationExtension;
    
});