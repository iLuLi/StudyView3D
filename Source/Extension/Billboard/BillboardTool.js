define([
    '../../Core/Constants/EventType',
    '../../Core/ToolInterface',
    '../../Core/i18n'
], function(EventType, ToolInterface, i18n) {
    'use strict';
    var BillboardTool = function (viewer) {
        ToolInterface.call(this);
        this.names = ['billboard'];

        var self = this;
        var _active = false;
        var _dragging = false;
        var _editting = false;

        var _nextId = 1; // record the annotation id

        var _lineOverlayName = "billboard-line";
        var _lineMaterial = null;
        var _lineColor = 0x3F7FBF;
        var _lineWidth = 1;

        this.annotations = [];
        this.numMarkers = [];

        this.filter = {
            seedURN: true,
            objectSet: true,
            viewport: true,
            tags: true, // Animation extension uses tags.
            renderOptions: false,
            cutplanes: true
        };

        this.isActive = function () {
            return _active;
        };

        this.activate = function () {
            _active = true;
            console.log("Billboard tool is activated");

            viewer.clearSelection();

            this.showAnnotations();
        };

        this.deactivate = function () {
            _active = false;
            console.log("Billboard tool is deactivated");

            this.hideAnnotations();

            if (this.billboard)
                this.destroyBillboard();
        };

        this.onCameraChange = function () {
            self.updateBillboard();
            self.updateAnnotations();
            self.highlightAnnotation();
        };

        // Project Vector3 to Vector2
        this.project = function (position) {
            var camera = viewer.navigation.getCamera();
            var containerBounds = viewer.navigation.getScreenViewport();

            var p = new THREE.Vector3().copy(position);
            p.project(camera);

            return new THREE.Vector2(Math.round((p.x + 1) / 2 * containerBounds.width),
                Math.round((-p.y + 1) / 2 * containerBounds.height));
        };

        // Project Vector2 to Vector3
        this.unproject = function (position) {
            var camera = viewer.navigation.getCamera();
            var containerBounds = viewer.navigation.getScreenViewport();
            var p = new THREE.Vector3();

            p.x = position.x / containerBounds.width * 2 - 1;
            p.y = -(position.y / containerBounds.height * 2 - 1);
            p.z = 0;

            p.unproject(camera);

            return p;
        };

        this.createBillboard = function (node, annotation) {

            // Only keep at most one billboard in the scene
            if (_editting)
                return;

            _editting = true;

            // Create Billboard Panel
            this.billboard = document.createElement("div");
            this.billboard.className = "billboard-container";
            viewer.container.appendChild(this.billboard);

            // Initialize the position of billboard
            this.billboard.deltaX = annotation ? annotation.deltaX : 100;
            this.billboard.deltaY = annotation ? annotation.deltaY : -150;
            this.setBillboardPosition(node.intersectPoint);
            this.moveHandler(this.billboard);
            this.billboard.intersectPoint = node.intersectPoint;

            // Create Text Area
            var textarea = document.createElement("TEXTAREA");
            textarea.className = "billboard-textarea";
            this.billboard.appendChild(textarea);
            textarea.setAttribute('rows', '4');
            textarea.setAttribute('maxlength', '140');
            textarea.focus();
            if (annotation) {
                textarea.value = annotation.childNodes[0].innerHTML;
            }

            var control = document.createElement("div");
            control.className = "billboard-control";
            this.billboard.appendChild(control);

            // Create Cancel Button
            var cancel = document.createElement("div");
            cancel.className = "billboard-button-cancel";
            var cancelText;
            if (annotation)
                cancelText = "Delete";
            else
                cancelText = "Cancel";
            cancel.setAttribute("data-i18n", cancelText);
            cancel.textContent = i18n.translate(cancelText);
            cancel.addEventListener('click', function () {
                self.destroyBillboard();
                if (annotation)
                    self.destroyNumMarker(annotation.id);
            }, false);
            control.appendChild(cancel);

            // Create Accept Button
            var accept = document.createElement("div");
            accept.className = "billboard-button-accept";
            accept.setAttribute("data-i18n", "Accept");
            accept.textContent = i18n.translate("Accept");
            accept.addEventListener('click', function () {
                // Only create the annotation when the user types something in the textarea
                if (self.billboard.childNodes[0].value) {
                    if (annotation)
                        self.createAnnotation(node, annotation.id);
                    else
                        self.createAnnotation(node);
                    self.destroyBillboard();
                }
            }, false);
            control.appendChild(accept);

            this.drawLeadLine(node.intersectPoint, this.billboard);
        };

        this.destroyBillboard = function () {
            _editting = false;

            viewer.impl.removeOverlay(_lineOverlayName, this.billboard.line);

            viewer.container.removeChild(this.billboard);
            this.billboard = null;
        };

        // Need to add offset to the position
        this.setBillboardPosition = function (position) {

            var pos = this.project(position);
            this.billboard.style.left = pos.x + this.billboard.deltaX + 'px';
            this.billboard.style.top = pos.y + this.billboard.deltaY + 'px';
        };

        this.createAnnotation = function (node, id) {

            // Create Annotation
            var annotation = document.createElement("div");
            annotation.className = "billboard-annotation";
            viewer.container.appendChild(annotation);

            // Initialize the position of annotation
            annotation.deltaX = this.billboard.deltaX;
            annotation.deltaY = this.billboard.deltaY;
            this.setAnnotationPosition(annotation, node.intersectPoint);
            this.moveHandler(annotation);
            annotation.intersectPoint = node.intersectPoint;

            if (id) {
                annotation.id = id;
                this.annotations[id - 1] = annotation;
            }
            else {
                annotation.id = _nextId++;
                this.annotations.push(annotation);
                this.createNumMarker(annotation);
            }

            var text = document.createElement("div");
            text.innerHTML = this.billboard.childNodes[0].value;
            annotation.appendChild(text);

            this.drawLeadLine(node.intersectPoint, annotation);

            // Create Comments Object
            var data = {
                message: self.billboard.childNodes[0].value,
                point3d: node.intersectPoint
            };
            var commentsExtension = viewer.getExtension("Autodesk.Comments");
            var cPromise = commentsExtension.createComment(data);

            function onSingleClick() {
                var clicks = 0;
                var timeout;

                function single() {
                    if (!annotation.dragging) {
                        if (annotation.classList.contains("billboard-annotation-highlight")) {
                            self.editAnnotation(node, annotation);
                        }
                        else {
                            self.highlightAnnotation(annotation);
                        }
                    }
                    else {
                        self.highlightAnnotation();
                    }
                }

                return function () {
                    clicks++;
                    if (clicks == 1) {
                        timeout = setTimeout(function () {
                            single();
                            clicks = 0;
                        }, 250);
                    }
                    else {
                        clearTimeout(timeout);
                        clicks = 0;
                    }
                }
            }

            cPromise.then(function (commObj) {

                annotation.addEventListener('click', onSingleClick(), false);
                annotation.addEventListener('dblclick', function () {
                    commentsExtension.restoreComment(commObj, self.filter, false);
                }, false);

                viewer.fireEvent(
                    { type: EventType.ANNOTATION_CREATED_EVENT, data: commObj }
                );
            }, function (err) {
                console.log("Create comments failed:" + err);
            });
        };

        this.destroyAnnotation = function (annotation) {
            viewer.impl.removeOverlay(_lineOverlayName, annotation.line);
            viewer.container.removeChild(annotation);
            this.annotations[annotation.id - 1] = undefined;
        };

        this.editAnnotation = function (node, annotation) {
            if (this.billboard) {
                this.destroyBillboard();
            }
            this.destroyAnnotation(annotation);
            this.createBillboard(node, annotation);
        };

        this.highlightAnnotation = function (annotation) {
            var elems = document.getElementsByClassName("billboard-annotation-highlight");
            for (var i = 0; i < elems.length; i++) {
                elems[i].classList.remove("billboard-annotation-highlight");
            }
            if (annotation)
                annotation.classList.add("billboard-annotation-highlight");
        };

        this.setAnnotationPosition = function (annotation, position) {

            var pos = this.project(position);
            annotation.style.left = pos.x + annotation.deltaX + 'px';
            annotation.style.top = pos.y + annotation.deltaY + 'px';
        };

        this.drawLeadLine = function (intersectPoint, parent) {

            var x = parseInt(parent.style.left, 10);
            var y = parseInt(parent.style.top, 10) + parent.childNodes[0].clientHeight;
            var pos = this.unproject(new THREE.Vector2(x, y));
            parent.line = this.drawLine(intersectPoint, pos);
        };

        this.drawLine = function (p1, p2) {

            if (!_lineMaterial) {
                _lineMaterial = new THREE.LineBasicMaterial({
                    color: _lineColor,
                    linewidth: _lineWidth,
                    depthTest: false,
                    depthWrite: false
                });

                viewer.impl.createOverlayScene(_lineOverlayName);
            }

            var lineGeom = new THREE.Geometry();
            lineGeom.vertices.push(p1);
            lineGeom.vertices.push(p2);
            var line = new THREE.Line(lineGeom, _lineMaterial);

            viewer.impl.addOverlay(_lineOverlayName, line);

            return line;
        };

        this.createNumMarker = function (annotation) {
            var numMarker = document.createElement('div');
            numMarker.className = 'billboard-marker';
            this.numMarkers.push(numMarker);
            numMarker.innerHTML = annotation.id;
            viewer.container.appendChild(numMarker);

            numMarker.position = annotation.intersectPoint;
            this.setNumMarkerPosition(numMarker);
        };

        this.destroyNumMarker = function (id) {
            viewer.container.removeChild(this.numMarkers[id - 1]);
            this.numMarkers[id - 1] = undefined;
        };

        this.setNumMarkerPosition = function (numMarker) {
            var pos = this.project(numMarker.position);
            numMarker.style.left = pos.x - numMarker.offsetWidth / 2 + 'px';
            numMarker.style.top = pos.y - numMarker.offsetHeight / 2 + 'px';
        };

        this.updateBillboard = function () {

            if (this.billboard) {
                // Update billboard position
                this.setBillboardPosition(this.billboard.intersectPoint);

                // Redraw the line
                this.updateLine(this.billboard);
            }

        };

        this.updateAnnotations = function () {

            for (var i = 0; i < this.annotations.length; i++) {
                if (this.annotations[i]) {
                    // Update annotation position
                    this.setAnnotationPosition(this.annotations[i], this.annotations[i].intersectPoint);

                    // Redraw the line
                    this.updateLine(this.annotations[i]);
                }
            }

            // Update numMarkers position
            for (var i = 0; i < this.numMarkers.length; i++) {
                if (this.numMarkers[i])
                    this.setNumMarkerPosition(this.numMarkers[i]);
            }

        };

        this.updateLine = function (parent) {

            var line = parent.line;
            viewer.impl.removeOverlay(_lineOverlayName, line);

            // Hide the line when the tool is deactivated.
            if (_active) {
                var intersectPoint = parent.intersectPoint;
                this.drawLeadLine(intersectPoint, parent);
            }
        };

        this.showAnnotations = function () {

            for (var i = 0; i < this.annotations.length; i++) {
                this.annotations[i].style.display = "block";
                this.updateLine(this.annotations[i]);
            }
        };

        this.hideAnnotations = function () {

            for (var i = 0; i < this.annotations.length; i++) {
                this.annotations[i].style.display = "none";
                this.updateLine(this.annotations[i]);
            }
        };

        this.moveHandler = function (mover) {

            var self = this;
            var x, y;
            var lastX, lastY;
            var startX, startY;
            var deltaX, deltaY;

            function handleMove(e) {
                if (e.type === "touchmove") {
                    e.screenX = e.touches[0].screenX;
                    e.screenY = e.touches[0].screenY;
                }

                deltaX += e.screenX - lastX;
                deltaY += e.screenY - lastY;

                x = startX + deltaX;
                y = startY + deltaY;

                mover.style.left = x + "px";
                mover.style.top = y + "px";

                // Redraw the line
                self.updateLine(mover);

                lastX = e.screenX;
                lastY = e.screenY;

                mover.dragging = true;
            }

            function handleUp(e) {
                // store the new offset between the mover and intersect point.
                var pos = self.project(mover.intersectPoint);
                mover.deltaX = x - pos.x;
                mover.deltaY = y - pos.y;

                window.removeEventListener('mousemove', handleMove);
                window.removeEventListener('mouseup', handleUp);
                window.removeEventListener('touchmove', handleMove);
                window.removeEventListener('touchend', handleUp);
            }

            function handleDown(e) {
                if (e.type === "touchstart") {
                    e.screenX = e.touches[0].screenX;
                    e.screenY = e.touches[0].screenY;
                }
                lastX = e.screenX;
                lastY = e.screenY;

                deltaX = 0;
                deltaY = 0;

                x = startX = mover.offsetLeft;
                y = startY = mover.offsetTop;

                mover.dragging = false;

                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
                window.addEventListener('touchmove', handleMove);
                window.addEventListener('touchend', handleUp);
            }

            mover.addEventListener('mousedown', handleDown);
            mover.addEventListener('touchstart', handleDown);
        };

        this.handleButtonDown = function (event, button) {
            _dragging = true;
            return false;
        };

        this.handleButtonUp = function (event, button) {
            _dragging = false;
            return false;
        };

        this.handleMouseMove = function (event) {
            return false;
        };

        this.handleSingleClick = function (event, button) {

            var node = viewer.impl.hitTest(event.canvasX, event.canvasY, false);
            if (node) {
                this.createBillboard(node);
            }
            return true;
        };

        this.handleDoubleClick = function (event, button) {
            return true;
        };

        this.handleSingleTap = function (event) {
            return this.handleSingleClick(event);
        };

        this.handleDoubleTap = function (event) {
            return true;
        };

    };

    return BillboardTool;
});