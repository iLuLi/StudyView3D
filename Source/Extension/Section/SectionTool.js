define([
    './SectionMesh',
    '../../Core/Constants/EventType',
    '../../Core/Intersector',
    '../../Core/Triangulator',
    '../../Core/VertexBufferBuilder',
    '../../Core/Utils/BufferGeometryUtils',
    '../../Core/Constants/LightPresets',
    '../../Core/Utils/getResourceUrl'
], function(SectionMesh, EventType, Intersector, Triangulator, VertexBufferBuilder, BufferGeometryUtils, LightPresets, getResourceUrl) {
    'use strict';
    var tintColor = { r: 1, g: 1, b: 0 };
    var tintIntensity = 0.2;
    
    
    /**
     * Tool that provides visual controls for the user to change the cutplane's position and angle.
     * It can (and should) be hooked to [ToolController's registerTool]{@Autodesk.Viewing.ToolController#registerTool}
     *
     * @param {Autodesk.Viewing.Viewer3D} viewer - Viewer3D instance
     * @param {Object} [options] - This component is not customizable.
     * @constructor
     */
    var SectionTool = function (viewer, options) {
        var _viewer = viewer.impl;
    
        var _names = ["section"];
        var _active = false;
    
        var _isDragging = false;
        var _isPlaneOn = true;
    
        var _transRotControl;
        var _transControl;
        var _sectionGroups = [];
        var _sectionPlanes = [];
        var _sectionPicker = [];
        var _activeMode = "";
        var _overlayName = "gizmo";
        var _touchType = null;
        var _initialized = false;
        var _visibleAtFirst = true;
        var _outlineIndices = [[0, 1], [1, 3], [3, 2], [2, 0]];
    
        init_TransformGizmos();
        // init_SectionMesh();
    
        function initControl() {
    
            if (_initialized)
                return;
    
            _transRotControl = new THREE.TransformControls(_viewer.camera, _viewer.canvas, "transrotate");
            _transRotControl.addEventListener('change', updateViewer);
            _transRotControl.setSnap(Math.PI / 2, Math.PI / 36); // snap to 90 degs within 5 degs range 
    
            _transControl = new THREE.TransformControls(_viewer.camera, _viewer.canvas, "translate");
            _transControl.addEventListener('change', updateViewer);
    
            // add to overlay scene
            if (_viewer.overlayScenes[_overlayName] === undefined) {
                _viewer.createOverlayScene(_overlayName);
            }
            _viewer.addOverlay(_overlayName, _transRotControl);
            _viewer.addOverlay(_overlayName, _transControl);
    
            viewer.addEventListener(EventType.CAMERA_CHANGE_EVENT, updateControls);
            viewer.addEventListener(EventType.ISOLATE_EVENT, updateSections);
            viewer.addEventListener(EventType.HIDE_EVENT, updateSections);
            viewer.addEventListener(EventType.SHOW_EVENT, updateSections);
    
            _initialized = true;
        }
    
        function deinitControl() {
    
            if (!_initialized)
                return;
    
            _viewer.removeOverlay(_overlayName, _transRotControl);
            _transRotControl.removeEventListener('change', updateViewer);
            _transRotControl = null;
            _viewer.removeOverlay(_overlayName, _transControl);
            _transControl.removeEventListener('change', updateViewer);
            _transControl = null;
            _viewer.removeOverlayScene(_overlayName);
    
            viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, updateControls);
            viewer.removeEventListener(EventType.ISOLATE_EVENT, updateSections);
            viewer.removeEventListener(EventType.HIDE_EVENT, updateSections);
            viewer.removeEventListener(EventType.SHOW_EVENT, updateSections);
    
            _initialized = false;
        }
    
        function updateViewer() {
            _viewer.invalidate(false, false, true);
        }
    
        function updateControls() {
            if (_transRotControl) {
                _transRotControl.update();
            }
            if (_transControl) {
                _transControl.update();
            }
        }
    
        function updateSections() {
            if (_sectionPlanes.length === 1) {
                updatePlaneMeshes(true);
                updateControls();
                updateCapMeshes(new THREE.Plane().setComponents(_sectionPlanes[0].x, _sectionPlanes[0].y, _sectionPlanes[0].z, _sectionPlanes[0].w));
            }
        }
    
        function mix(a, b, val) {
            return a * (1.0 - val) + b * val;
        }
    
        function getDiffuseColor(material) {
            return material.color || new THREE.Color(0xffffff);
        }
    
        function getSpecularColor(material) {
            return material.specular || new THREE.Color(0xffffff);
        }
    
        function tintColor(c) {
            var intensity = tintIntensity;
            var tc = tintColor;
            c.r = mix(c.r, tc.r, intensity);
            c.g = mix(c.g, tc.g, intensity);
            c.b = mix(c.b, tc.b, intensity);
        }
    
        function updateCapMeshes(plane) {
    
            // init_three_triangulator();
            // init_three_intersector();
    
    
            var oldsection = _viewer.sceneAfter.getObjectByName("section");
            if (oldsection)
                _viewer.sceneAfter.remove(oldsection);
    
            var section = new THREE.Object3D();
            section.name = "section";
            _viewer.sceneAfter.add(section);
    
            var section3D = new THREE.Object3D();
            section.add(section3D);
            var section2D = new THREE.Object3D();
            section.add(section2D);
    
    
    
            var toPlaneCoords = Intersector.makePlaneBasis(plane);
            var fromPaneCoords = new THREE.Matrix4().getInverse(toPlaneCoords);
    
            var mat2dname = _viewer.matman().create2DMaterial(null, { skipCircles: true, skipEllipticals: true }, false, false);
            var mat2d = _viewer.matman().findMaterial(null, mat2dname);
            mat2d.transparent = true;
            mat2d.depthTest = true;
            mat2d.polygonOffset = true;
            mat2d.polygonOffsetFactor = -1;
            mat2d.polygonOffsetUnits = 0.1;    // 1.0 is usually way too high, see LMV-1072
    
            var box = new THREE.Box3();
    
            var worldBox = _viewer.getVisibleBounds(true);
    
            //some heuristic for line width of the section outline based on model size
            //half a percent of the model size is what we do here.
            var lineWidth = 0.5 * 5e-5 * worldBox.size().length();
    
            var models = _viewer.modelQueue().getModels();
    
            models.forEach(function (model) {
    
                var it = model.getData().instanceTree;
                if (!it)
                    return;
                var frags = model.getFragmentList();
    
                //We have to go node by node and combine the fragments for each node into
                //a single 2D slice polygon.
                it.enumNodeChildren(model.getRootId(), function (dbId) {
    
                    if (it.isNodeHidden(dbId) || it.isNodeOff(dbId)) {
                        return;
                    }
    
                    var intersects = [];
                    var m;
    
                    //All fragments that belong to the same node make part of the
                    //same object so we have to accumulate all their intersections into one list
                    it.enumNodeFragments(dbId, function (fragId) {
    
                        frags.getWorldBounds(fragId, box);
                        if (!Intersector.intersectBoxPlane(plane, box))
                            return;
    
                        m = frags.getVizmesh(fragId);
    
                        if (!m.geometry)
                            return;
                        if (m.geometry.is2d || m.geometry.isLines)
                            return;
                        if (!m.material.cutplanes)
                            return;
    
                        Intersector.intersectMeshPlane(plane, m, intersects);
    
                    }, false);
    
    
                    if (intersects.length) {
    
                        var bbox = new THREE.Box3();
                        Intersector.convertToPlaneCoords(toPlaneCoords, intersects, bbox);
    
                        //Create the 2D line geometry
                        var vbb = new VertexBufferBuilder(false, 8 * intersects.length);
    
                        var color = getDiffuseColor(m.material);
                        var r = 0 | (color.r * 0.25) * 255.5;
                        var g = 0 | (color.g * 0.25) * 255.5;
                        var b = 0 | (color.b * 0.25) * 255.5;
    
                        var c = 0xff000000 | (b << 16) | (g << 8) | r;
    
                        var cset = new Triangulator.ContourSet(intersects, bbox);
                        cset.snapEdges();
                        cset.sanitizeEdges();
                        cset.stitchContours();
    
                        for (var j = 0; j < cset.contours.length; j++) {
    
                            var cntr = cset.contours[j];
    
                            var r = 0 | Math.random() * 255.5;
                            var g = 0 | Math.random() * 255.5;
                            var b = 0 | Math.random() * 255.5;
                            var rc = 0xff000000 | (b << 16) | (g << 8) | r;
    
                            var isClosed = (cntr[0] === cntr[cntr.length - 1]);
    
                            for (var k = 1; k < cntr.length; k++) {
                                var pt1 = cset.pts[cntr[k - 1]];
                                var pt2 = cset.pts[cntr[k]];
                                vbb.addSegment(pt1.x, pt1.y, pt2.x, pt2.y, 0, 0.02, /*isClosed ? c : rc*/c, dbId, 0);
                            }
    
                        }
    
    
                        var mdata = { mesh: vbb.toMesh() };
    
                        BufferGeometryUtils.meshToGeometry(mdata);
    
                        var bg2d = mdata.geometry;
                        bg2d.streamingDraw = true;
                        bg2d.streamingIndex = true;
    
                        var mesh2d = new THREE.Mesh(bg2d, mat2d);
    
                        mesh2d.matrix.copy(fromPaneCoords);
                        mesh2d.matrixAutoUpdate = false;
                        mesh2d.frustumCulled = false;
                        section2D.add(mesh2d);
    
    
                        //Create triangulated capping polygon
                        if (true) {
    
                            //Create the 3D mesh
                            var tin = new Triangulator.TriangulatedSurface(cset);
    
                            if (tin.indices.length) {
    
                                var bg = new THREE.BufferGeometry();
    
                                var pos = new Float32Array(3 * tin.pts.length);
                                for (var j = 0; j < tin.pts.length; j++) {
                                    pos[3 * j] = tin.pts[j].x;
                                    pos[3 * j + 1] = tin.pts[j].y;
                                    pos[3 * j + 2] = 0;
                                }
                                bg.addAttribute("position", new THREE.BufferAttribute(pos, 3));
    
                                var packNormals = m.material.packedNormals;
                                var normal = packNormals ? new Uint16Array(2 * tin.pts.length) : new Float32Array(3 * tin.pts.length);
    
                                for (var j = 0; j < tin.pts.length; j++) {
    
                                    if (packNormals) {
                                        var pnx = (0/*Math.atan2(0, 0)*/ / Math.PI + 1.0) * 0.5;
                                        var pny = (1.0 + 1.0) * 0.5;
    
                                        normal[j * 2] = (pnx * 65535) | 0;
                                        normal[j * 2 + 1] = (pny * 65535) | 0;
                                    } else {
                                        normal[3 * j] = 0;
                                        normal[3 * j + 1] = 0;
                                        normal[3 * j + 2] = 1;
                                    }
                                }
    
                                bg.addAttribute("normal", new THREE.BufferAttribute(normal, packNormals ? 2 : 3));
                                if (packNormals) {
                                    bg.attributes.normal.bytesPerItem = 2;
                                    bg.attributes.normal.normalize = true;
                                }
    
                                var index = new Uint16Array(tin.indices.length);
                                index.set(tin.indices);
    
                                bg.addAttribute("index", new THREE.BufferAttribute(index, 1));
    
                                bg.streamingDraw = true;
                                bg.streamingIndex = true;
    
                                var mat = _viewer.matman().cloneMaterial(m.material);
    
                                mat.packedNormals = packNormals;
                                mat.cutplanes = null;
                                mat.side = THREE.FrontSide;
                                mat.depthTest = true;
                                mat.map = null;
                                mat.bumpMap = null;
                                mat.normalMap = null;
                                mat.alphaMap = null;
                                mat.specularMap = null;
                                mat.transparent = false;
                                mat.depthWrite = true;
                                mat.hatchPattern = true;
                                mat.needsUpdate = true;
    
                                var angle = (m.material.id + 2) * Math.PI * 0.125;
                                var tan = Math.tan(angle);
                                mat.hatchParams = new THREE.Vector2(tan, 10.0);
                                mat.hatchTintColor = tintColor;
                                mat.hatchTintIntensity = tintIntensity;
    
                                // If the material is prism, clear all the map definitions.
                                if (mat.prismType != null) {
                                    mat.defines = {};
                                    mat.defines[mat.prismType.toUpperCase()] = "";
                                    if (mat.prismType == "PrismWood") {
                                        mat.defines["NO_UVW"] = "";
                                    }
                                }
    
                                var capmesh = new THREE.Mesh(bg, mat);
                                capmesh.matrix.copy(fromPaneCoords);
                                capmesh.matrixAutoUpdate = false;
                                capmesh.dbId = dbId;
                                capmesh.fragId = intersects.fragId;
    
                                section3D.add(capmesh);
                            }
    
                        }
    
                    }
    
    
                }, true); //enumNodeChildren
    
            }); //models.forEach
    
        }
    
        function createPlaneMesh(plane, bbox) {
            var quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
            var geometry;
    
            if (bbox) {
                // project bbox to set plane size
                var ptMax = plane.projectPoint(bbox.max);
                var ptMin = plane.projectPoint(bbox.min);
                var invQuat = quat.clone().inverse();
                ptMax.applyQuaternion(invQuat);
                ptMin.applyQuaternion(invQuat);
                var size = new THREE.Vector3().subVectors(ptMax, ptMin);
                geometry = new THREE.PlaneBufferGeometry(size.x, size.y);
            } else {
                // project bounding sphere
                bbox = _viewer.getVisibleBounds();
                var size = 2.0 * bbox.getBoundingSphere().radius;
                geometry = new THREE.PlaneBufferGeometry(size, size);
            }
    
            var material = new THREE.MeshBasicMaterial({
                opacity: 0,
                color: 0xffffff,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });
    
            var mesh = new SectionMesh(geometry, material, plane);
            var pt = plane.projectPoint(bbox.center());
            mesh.position.copy(pt);
            mesh.quaternion.multiply(quat);
    
            // add outlines with inverted background color
            var bgColor = LightPresets[_viewer.currentLightPreset()].bgColorGradient;
            var color = "rgb(" + (255 - bgColor[0]) + "," + (255 - bgColor[1]) + "," + (255 - bgColor[2]) + ")";
            var lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 1, depthTest: false });
            var pos = mesh.geometry.getAttribute('position');
            for (var i = 0; i < _outlineIndices.length; i++) {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3().fromArray(pos.array, _outlineIndices[i][0] * pos.itemSize),
                                       new THREE.Vector3().fromArray(pos.array, _outlineIndices[i][1] * pos.itemSize));
                var line = new THREE.Line(geometry, lineMaterial);
                mesh.add(line);
                mesh.outlines.push(line);
            }
    
            return mesh;
        }
    
        function updatePlaneMeshes(rebuild) {
    
            traverseSections(function (child) {
                if (child instanceof SectionMesh) {
    
                    if (child.connectivity.length > 0) {
                        // section box
                        var minv = new THREE.Matrix4().getInverse(child.matrixWorld);
                        var pt = new THREE.Vector3();
                        var pos = child.geometry.getAttribute('position');
                        for (var i = 0; i < pos.length / pos.itemSize; i++) {
                            var connect = child.connectivity[i];
                            if (intersectPlanes(child.plane, connect[0], connect[1], pt) !== null) {
                                pt.applyMatrix4(minv);
                                pos.setXYZ(i, pt.x, pt.y, pt.z);
                            }
                        };
                        pos.needsUpdate = true;
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
    
                        for (var i = 0; i < child.outlines.length; i++) {
                            var line = child.outlines[i];
                            line.geometry.vertices[0].fromArray(pos.array, _outlineIndices[i][0] * pos.itemSize);
                            line.geometry.vertices[1].fromArray(pos.array, _outlineIndices[i][1] * pos.itemSize);
                            line.geometry.verticesNeedUpdate = true;
                        }
                    } else {
                        // section plane
                        if (rebuild) {
                            var bbox = _viewer.getVisibleBounds();
                            var size = 2.0 * bbox.getBoundingSphere().radius;
                            var pt = child.plane.projectPoint(bbox.center());
                            child.geometry = new THREE.PlaneBufferGeometry(size, size);
                            child.position.copy(pt);
                            var pos = child.geometry.getAttribute('position');
                            for (var i = 0; i < child.outlines.length; i++) {
                                var line = child.outlines[i];
                                line.geometry.vertices[0].fromArray(pos.array, _outlineIndices[i][0] * pos.itemSize);
                                line.geometry.vertices[1].fromArray(pos.array, _outlineIndices[i][1] * pos.itemSize);
                                line.geometry.verticesNeedUpdate = true;
                            }
                        }
                    }
                }
            });
        }
    
        function traverseSections(callback) {
            for (var i = 0; i < _sectionGroups.length; i++) {
                _sectionGroups[i].traverse(callback);
            }
        }
    
        function setSectionPlanes() {
            traverseSections(function (child) {
                if (child instanceof SectionMesh) {
                    child.update();
                }
            });
            if (_sectionPlanes.length === 1) {
                updateCapMeshes(new THREE.Plane().setComponents(_sectionPlanes[0].x, _sectionPlanes[0].y, _sectionPlanes[0].z, _sectionPlanes[0].w));
            }
            _viewer.setCutPlanes(_sectionPlanes);
        }
    
        function showPlane(set) {
            for (var i = 0; i < _sectionGroups.length; i++) {
                _sectionGroups[i].visible = set;
            }
    
            if (_isPlaneOn !== set)
                updateViewer();
    
            _isPlaneOn = set;
        }
    
        function showSection(set) {
            if (set && _sectionPlanes.length > 0) {
                if (_sectionPlanes.length === 1) {
                    updateCapMeshes(new THREE.Plane().setComponents(_sectionPlanes[0].x, _sectionPlanes[0].y, _sectionPlanes[0].z, _sectionPlanes[0].w));
                }
                viewer.setCutPlanes(_sectionPlanes);
            }
            showPlane(set);
        }
    
        function attachControl(control, mesh) {
            control.attach(mesh);
            control.setPosition(mesh.position);
            control.visible = true;
        }
    
        function setPlane(normal) {
            // flip normal if facing inward as eye direction
            var eyeVec = _viewer.api.navigation.getEyeVector();
            if (eyeVec.dot(normal) > 0) {
                normal.negate();
            }
            var group = new THREE.Group();
            var plane = new THREE.Plane(normal, 0);
            var mesh = createPlaneMesh(plane, null);
            group.add(mesh);
            _sectionPlanes.push(mesh.planeVec);
            _sectionGroups.push(group);
            _viewer.addOverlay(_overlayName, group);
            attachControl(_transRotControl, mesh);
            _transRotControl.showRotationGizmos(true);
            _sectionPicker = _transRotControl.getPicker();
            setSectionPlanes();
        }
    
        function setBox() {
            var normals = [
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, -1, 0),
                new THREE.Vector3(0, 0, -1)
            ];
    
            var connectivities = [
                [[1, 2], [1, 5], [2, 4], [4, 5]], // 0
                [[3, 5], [0, 5], [2, 3], [0, 2]], // 1
                [[1, 3], [0, 1], [3, 4], [0, 4]], // 2
                [[1, 5], [1, 2], [4, 5], [2, 4]], // 3
                [[2, 3], [0, 2], [3, 5], [0, 5]], // 4
                [[0, 1], [3, 1], [0, 4], [3, 4]]  // 5
            ];
    
            var group = new THREE.Group();
            var obbox = _viewer.getVisibleBounds();
            var center = obbox.center();
            var bbox = new THREE.Box3(obbox.min, center);
            var planes = [], meshes = [];
            for (var i = 0; i < normals.length; i++) {
                var plane = new THREE.Plane(normals[i], -1 * center.dot(normals[i]));
                planes.push(plane);
    
                // offset plane with negative normal to form an octant
                if (i > 2) {
                    var ptMax = plane.orthoPoint(bbox.max);
                    var ptMin = plane.orthoPoint(bbox.min);
                    var size = new THREE.Vector3().subVectors(ptMax, ptMin);
                    plane.constant -= size.length();
                }
    
                var mesh = createPlaneMesh(plane, bbox);
                group.add(mesh);
                meshes.push(mesh);
                _sectionPlanes.push(mesh.planeVec);
            }
    
            // build connectivity
            for (var i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];
                var connectivity = connectivities[i];
                for (var j = 0; j < connectivity.length; j++) {
                    var nc = [];
                    var ct = connectivity[j];
                    for (var k = 0; k < ct.length; k++) {
                        nc.push(planes[ct[k]]);
                    }
                    mesh.connectivity.push(nc);
                }
            }
    
            _sectionGroups.push(group);
            _viewer.addOverlay(_overlayName, group);
    
            attachControl(_transRotControl, _sectionGroups[0].children[0]);
            attachControl(_transControl, _sectionGroups[0]);
            _transRotControl.showRotationGizmos(false);
            _sectionPicker = _transRotControl.getPicker().concat(_transControl.getPicker());
    
            setSectionPlanes();
        }
    
        var intersectPlanes = (function () {
            var m = new THREE.Matrix3();
            var n23 = new THREE.Vector3();
            var n31 = new THREE.Vector3();
            var n12 = new THREE.Vector3();
            return function (plane1, plane2, plane3, optionalTarget) {
                m.set(plane1.normal.x, plane1.normal.y, plane1.normal.z,
                      plane2.normal.x, plane2.normal.y, plane2.normal.z,
                      plane3.normal.x, plane3.normal.y, plane3.normal.z);
    
                var det = m.determinant();
                if (det === 0) return null;
    
                n23.crossVectors(plane2.normal, plane3.normal).multiplyScalar(-plane1.constant);
                n31.crossVectors(plane3.normal, plane1.normal).multiplyScalar(-plane2.constant);
                n12.crossVectors(plane1.normal, plane2.normal).multiplyScalar(-plane3.constant);
    
                var result = optionalTarget || new THREE.Vector3();
                return result.copy(n23).add(n31).add(n12).divideScalar(det);
            };
        })();
    
        var intersectObjects = (function () {
            var pointerVector = new THREE.Vector3();
            var pointerDir = new THREE.Vector3();
            var ray = new THREE.Raycaster();
            var camera = _viewer.camera;
    
            return function (pointer, objects, recursive) {
                var rect = _viewer.canvas.getBoundingClientRect();
                var x = ((pointer.clientX - rect.left) / rect.width) * 2 - 1;
                var y = -((pointer.clientY - rect.top) / rect.height) * 2 + 1;
    
                if (camera.isPerspective) {
                    pointerVector.set(x, y, 0.5);
                    pointerVector.unproject(camera);
                    ray.set(camera.position, pointerVector.sub(camera.position).normalize());
                } else {
                    pointerVector.set(x, y, -1);
                    pointerVector.unproject(camera);
                    pointerDir.set(0, 0, -1);
                    ray.set(pointerVector, pointerDir.transformDirection(camera.matrixWorld));
                }
    
                var intersections = ray.intersectObjects(objects, recursive);
                return intersections[0] ? intersections[0] : null;
            };
        })();
    
        // public functions
    
        /**
         * When active, the geometry will be sectioned by the current set cut plane.
         * @returns {boolean}
         */
        this.isActive = function () {
            return _active;
        };
    
        /**
         * Facilitates the initialization of a cut plane
         *
         * @param {String} name - Either 'X', 'Y', 'Z' or 'BOX'
         */
        this.setSection = function (name) {
            this.clearSection();
            switch (name) {
                case 'X':
                    var normal = new THREE.Vector3(1, 0, 0);
                    setPlane(normal);
                    break;
                case 'Y':
                    var normal = new THREE.Vector3(0, 1, 0);
                    setPlane(normal);
                    break;
                case 'Z':
                    var normal = new THREE.Vector3(0, 0, 1);
                    setPlane(normal);
                    break;
                case 'BOX':
                    setBox();
                    break;
            }
            _activeMode = name;
        };
    
        /**
         * Removes any (and all) currently set cut plane(s).
         */
        this.clearSection = function () {
    
            if (_transRotControl)
                _transRotControl.detach();
    
            if (_transControl)
                _transControl.detach();
    
            // remove all sections
            while (_sectionPlanes.length > 0) {
                _sectionPlanes.pop();
            }
    
            while (_sectionGroups.length > 0) {
                var group = _sectionGroups.pop();
                _viewer.removeOverlay(_overlayName, group);
            }
    
            var oldsection = _viewer.sceneAfter.getObjectByName("section");
            if (oldsection)
                _viewer.sceneAfter.remove(oldsection);
    
            _viewer.setCutPlanes();
        };
    
        this.isPlaneOn = function () {
            return _isPlaneOn;
        };
    
        this.showPlane = function (set) {
            showPlane(set);
        };
    
        /**
         * Whether translation and rotation controls are visible or not.
         * @param {Boolean} set
         */
        this.attachControl = function (set) {
            if (set) {
                attachControl(_transRotControl, _sectionGroups[0].children[0]);
                _transRotControl.highlight();
                if (_activeMode === 'BOX')
                    attachControl(_transControl, _sectionGroups[0]);
            } else {
                _transRotControl.detach();
                _transControl.detach();
            }
        };
    
        /**
         * Invokes setSection with the last set of parameters used.
         */
        this.resetSection = function () {
            this.setSection(_activeMode);
        };
    
        // tool interface
    
        this.getNames = function () {
            return _names;
        };
    
        this.getName = function () {
            return _names[0];
        };
    
        this.register = function () {
        };
    
        this.deregister = function () {
            this.clearSection();
            deinitControl();
        };
    
        /**
         * [ToolInterface] Activates the tool
         * @param {String} name - unused
         */
        this.activate = function (name) {
    
            initControl();
    
            _active = true;
            _isDragging = false;
            _visibleAtFirst = true;
    
            // keep only one section all the time per design
            _sectionPlanes = _sectionPlanes || [];
    
            showSection(true);
        };
    
        /**
         * [ToolInterface] Deactivates the tool
         * @param {String} name - unused
         */
        this.deactivate = function (name) {
            _active = false;
            _isDragging = false;
    
            var oldsection = _viewer.sceneAfter.getObjectByName("section");
            if (oldsection)
                _viewer.sceneAfter.remove(oldsection);
    
    
            showSection(false);
            _viewer.setCutPlanes();
            _transRotControl.detach();
            _transControl.detach();
        };
    
        this.update = function (highResTimestamp) {
            return false;
        };
    
        this.handleSingleClick = function (event, button) {
            var pointer = event.pointers ? event.pointers[0] : event;
            var result = intersectObjects(pointer, _sectionGroups[0].children);
            if (result) {
                attachControl(_transRotControl, result.object);
                _transRotControl.highlight();
                updateViewer();
            }
    
            return false;
        };
    
        this.handleDoubleClick = function (event, button) {
            return false;
        };
    
        this.handleSingleTap = function (event) {
            return this.handleSingleClick(event, 0);
        };
    
        this.handleDoubleTap = function (event) {
            return false;
        };
    
        this.handleKeyDown = function (event, keyCode) {
            return false;
        };
    
        this.handleKeyUp = function (event, keyCode) {
            return false;
        };
    
        this.handleWheelInput = function (delta) {
            return false;
        };
    
        this.handleButtonDown = function (event, button) {
            _isDragging = true;
            if (_transControl.onPointerDown(event))
                return true;
            return _transRotControl.onPointerDown(event);
        };
    
        this.handleButtonUp = function (event, button) {
            _isDragging = false;
            if (_transControl.onPointerUp(event))
                return true;
            return _transRotControl.onPointerUp(event);
        };
    
        this.handleMouseMove = function (event) {
            if (_isDragging) {
                if (_transControl.onPointerMove(event)) {
                    setSectionPlanes();
                    _transRotControl.update();
                    return true;
                }
                if (_transRotControl.onPointerMove(event)) {
                    setSectionPlanes();
                    updatePlaneMeshes();
                    return true;
                }
            }
    
            if (event.pointerType !== 'touch') {
                var pointer = event.pointers ? event.pointers[0] : event;
                var result = intersectObjects(pointer, _sectionGroups[0].children);
                if (result) {
                    _visibleAtFirst = false;
                }
    
                // show gizmo + plane when intersecting on non-touch 
                var visible = _visibleAtFirst || (result || intersectObjects(pointer, _sectionPicker, true)) ? true : false;
                _transRotControl.visible = visible;
                _transControl.visible = _transControl.object !== undefined && visible;
                showPlane(visible);
            }
    
            if (_transControl.onPointerHover(event))
                return true;
    
            return _transRotControl.onPointerHover(event);
        };
    
        this.handleGesture = function (event) {
            switch (event.type) {
                case "dragstart":
                    _touchType = "drag";
                    // Single touch, fake the mouse for now...
                    return this.handleButtonDown(event, 0);
    
                case "dragmove":
                    return (_touchType === "drag") ? this.handleMouseMove(event) : false;
    
                case "dragend":
                    if (_touchType === "drag") {
                        _touchType = null;
                        return this.handleButtonUp(event, 0);
                    }
                    return false;
            }
            return false;
        };
    
        this.handleBlur = function (event) {
            return false;
        };
    
        this.handleResize = function () {
        };
    
        this.handlePressHold = function (event) {
            return true;
        };
    };

    /**
 * @author arodic / https://github.com/arodic
 *
 * @author chiena -- Modified for Autodesk LMV web viewer
 */
/*jshint sub:true*/

function init_TransformGizmos() {
    
        'use strict';
    
        var GizmoMaterial = function (parameters) {
    
            THREE.MeshBasicMaterial.call(this);
    
            this.depthTest = false;
            this.depthWrite = false;
            this.side = THREE.FrontSide;
            this.transparent = true;
    
            this.setValues(parameters);
    
            this.oldColor = this.color.clone();
            this.oldOpacity = this.opacity;
    
            this.highlight = function (highlighted) {
    
                if (highlighted) {
    
                    this.color.setRGB(1, 230 / 255, 3 / 255);
                    this.opacity = 1;
    
                } else {
    
                    this.color.copy(this.oldColor);
                    this.opacity = this.oldOpacity;
    
                }
    
            };
    
        };
    
        GizmoMaterial.prototype = Object.create(THREE.MeshBasicMaterial.prototype);
    
        var GizmoLineMaterial = function (parameters) {
    
            THREE.LineBasicMaterial.call(this);
    
            this.depthTest = false;
            this.depthWrite = false;
            this.transparent = true;
            this.linewidth = 1;
    
            this.setValues(parameters);
    
            this.oldColor = this.color.clone();
            this.oldOpacity = this.opacity;
    
            this.highlight = function (highlighted) {
    
                if (highlighted) {
    
                    this.color.setRGB(1, 230 / 255, 3 / 255);
                    this.opacity = 1;
    
                } else {
    
                    this.color.copy(this.oldColor);
                    this.opacity = this.oldOpacity;
    
                }
    
            };
    
        };
    
        GizmoLineMaterial.prototype = Object.create(THREE.LineBasicMaterial.prototype);
    
        // polyfill
        if (THREE.PolyhedronGeometry === undefined) {
            THREE.PolyhedronGeometry = function (vertices, indices, radius, detail) {
    
                THREE.Geometry.call(this);
    
                this.type = 'PolyhedronGeometry';
    
                this.parameters = {
                    vertices: vertices,
                    indices: indices,
                    radius: radius,
                    detail: detail
                };
    
                radius = radius || 1;
                detail = detail || 0;
    
                var that = this;
    
                for (var i = 0, l = vertices.length; i < l; i += 3) {
    
                    prepare(new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]));
    
                }
    
                var midpoints = [], p = this.vertices;
    
                var faces = [];
    
                for (var i = 0, j = 0, l = indices.length; i < l; i += 3, j++) {
    
                    var v1 = p[indices[i]];
                    var v2 = p[indices[i + 1]];
                    var v3 = p[indices[i + 2]];
    
                    faces[j] = new THREE.Face3(v1.index, v2.index, v3.index, [v1.clone(), v2.clone(), v3.clone()]);
    
                }
    
                var centroid = new THREE.Vector3();
    
                for (var i = 0, l = faces.length; i < l; i++) {
    
                    subdivide(faces[i], detail);
    
                }
    
    
                // Handle case when face straddles the seam
    
                for (var i = 0, l = this.faceVertexUvs[0].length; i < l; i++) {
    
                    var uvs = this.faceVertexUvs[0][i];
    
                    var x0 = uvs[0].x;
                    var x1 = uvs[1].x;
                    var x2 = uvs[2].x;
    
                    var max = Math.max(x0, Math.max(x1, x2));
                    var min = Math.min(x0, Math.min(x1, x2));
    
                    if (max > 0.9 && min < 0.1) { // 0.9 is somewhat arbitrary
    
                        if (x0 < 0.2) uvs[0].x += 1;
                        if (x1 < 0.2) uvs[1].x += 1;
                        if (x2 < 0.2) uvs[2].x += 1;
    
                    }
    
                }
    
    
                // Apply radius
    
                for (var i = 0, l = this.vertices.length; i < l; i++) {
    
                    this.vertices[i].multiplyScalar(radius);
    
                }
    
    
                // Merge vertices
    
                this.mergeVertices();
    
                this.computeFaceNormals();
    
                this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
    
    
                // Project vector onto sphere's surface
    
                function prepare(vector) {
    
                    var vertex = vector.normalize().clone();
                    vertex.index = that.vertices.push(vertex) - 1;
    
                    // Texture coords are equivalent to map coords, calculate angle and convert to fraction of a circle.
    
                    var u = azimuth(vector) / 2 / Math.PI + 0.5;
                    var v = inclination(vector) / Math.PI + 0.5;
                    vertex.uv = new THREE.Vector2(u, 1 - v);
    
                    return vertex;
    
                }
    
    
                // Approximate a curved face with recursively sub-divided triangles.
    
                function make(v1, v2, v3) {
    
                    var face = new THREE.Face3(v1.index, v2.index, v3.index, [v1.clone(), v2.clone(), v3.clone()]);
                    that.faces.push(face);
    
                    centroid.copy(v1).add(v2).add(v3).divideScalar(3);
    
                    var azi = azimuth(centroid);
    
                    that.faceVertexUvs[0].push([
                        correctUV(v1.uv, v1, azi),
                        correctUV(v2.uv, v2, azi),
                        correctUV(v3.uv, v3, azi)
                    ]);
    
                }
    
    
                // Analytically subdivide a face to the required detail level.
    
                function subdivide(face, detail) {
    
                    var cols = Math.pow(2, detail);
                    var cells = Math.pow(4, detail);
                    var a = prepare(that.vertices[face.a]);
                    var b = prepare(that.vertices[face.b]);
                    var c = prepare(that.vertices[face.c]);
                    var v = [];
    
                    // Construct all of the vertices for this subdivision.
    
                    for (var i = 0 ; i <= cols; i++) {
    
                        v[i] = [];
    
                        var aj = prepare(a.clone().lerp(c, i / cols));
                        var bj = prepare(b.clone().lerp(c, i / cols));
                        var rows = cols - i;
    
                        for (var j = 0; j <= rows; j++) {
    
                            if (j == 0 && i == cols) {
    
                                v[i][j] = aj;
    
                            } else {
    
                                v[i][j] = prepare(aj.clone().lerp(bj, j / rows));
    
                            }
    
                        }
    
                    }
    
                    // Construct all of the faces.
    
                    for (var i = 0; i < cols ; i++) {
    
                        for (var j = 0; j < 2 * (cols - i) - 1; j++) {
    
                            var k = Math.floor(j / 2);
    
                            if (j % 2 == 0) {
    
                                make(
                                    v[i][k + 1],
                                    v[i + 1][k],
                                    v[i][k]
                                );
    
                            } else {
    
                                make(
                                    v[i][k + 1],
                                    v[i + 1][k + 1],
                                    v[i + 1][k]
                                );
    
                            }
    
                        }
    
                    }
    
                }
    
    
                // Angle around the Y axis, counter-clockwise when looking from above.
    
                function azimuth(vector) {
    
                    return Math.atan2(vector.z, -vector.x);
    
                }
    
    
                // Angle above the XZ plane.
    
                function inclination(vector) {
    
                    return Math.atan2(-vector.y, Math.sqrt((vector.x * vector.x) + (vector.z * vector.z)));
    
                }
    
    
                // Texture fixing helper. Spheres have some odd behaviours.
    
                function correctUV(uv, vector, azimuth) {
    
                    if ((azimuth < 0) && (uv.x === 1)) uv = new THREE.Vector2(uv.x - 1, uv.y);
                    if ((vector.x === 0) && (vector.z === 0)) uv = new THREE.Vector2(azimuth / 2 / Math.PI + 0.5, uv.y);
                    return uv.clone();
    
                }
    
            };
    
            THREE.PolyhedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
        }
    
        // polyfill
        if (THREE.OctahedronGeometry === undefined) {
            THREE.OctahedronGeometry = function (radius, detail) {
    
                this.parameters = {
                    radius: radius,
                    detail: detail
                };
    
                var vertices = [
                    1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1
                ];
    
                var indices = [
                    0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2
                ];
    
                THREE.PolyhedronGeometry.call(this, vertices, indices, radius, detail);
    
                this.type = 'OctahedronGeometry';
    
                this.parameters = {
                    radius: radius,
                    detail: detail
                };
            };
    
            THREE.OctahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
        }
    
        // polyfill
        if (THREE.TorusGeometry === undefined) {
            THREE.TorusGeometry = function (radius, tube, radialSegments, tubularSegments, arc) {
    
                THREE.Geometry.call(this);
    
                this.type = 'TorusGeometry';
    
                this.parameters = {
                    radius: radius,
                    tube: tube,
                    radialSegments: radialSegments,
                    tubularSegments: tubularSegments,
                    arc: arc
                };
    
                radius = radius || 100;
                tube = tube || 40;
                radialSegments = radialSegments || 8;
                tubularSegments = tubularSegments || 6;
                arc = arc || Math.PI * 2;
    
                var center = new THREE.Vector3(), uvs = [], normals = [];
    
                for (var j = 0; j <= radialSegments; j++) {
    
                    for (var i = 0; i <= tubularSegments; i++) {
    
                        var u = i / tubularSegments * arc;
                        var v = j / radialSegments * Math.PI * 2;
    
                        center.x = radius * Math.cos(u);
                        center.y = radius * Math.sin(u);
    
                        var vertex = new THREE.Vector3();
                        vertex.x = (radius + tube * Math.cos(v)) * Math.cos(u);
                        vertex.y = (radius + tube * Math.cos(v)) * Math.sin(u);
                        vertex.z = tube * Math.sin(v);
    
                        this.vertices.push(vertex);
    
                        uvs.push(new THREE.Vector2(i / tubularSegments, j / radialSegments));
                        normals.push(vertex.clone().sub(center).normalize());
    
                    }
    
                }
    
                for (var j = 1; j <= radialSegments; j++) {
    
                    for (var i = 1; i <= tubularSegments; i++) {
    
                        var a = (tubularSegments + 1) * j + i - 1;
                        var b = (tubularSegments + 1) * (j - 1) + i - 1;
                        var c = (tubularSegments + 1) * (j - 1) + i;
                        var d = (tubularSegments + 1) * j + i;
    
                        var face = new THREE.Face3(a, b, d, [normals[a].clone(), normals[b].clone(), normals[d].clone()]);
                        this.faces.push(face);
                        this.faceVertexUvs[0].push([uvs[a].clone(), uvs[b].clone(), uvs[d].clone()]);
    
                        face = new THREE.Face3(b, c, d, [normals[b].clone(), normals[c].clone(), normals[d].clone()]);
                        this.faces.push(face);
                        this.faceVertexUvs[0].push([uvs[b].clone(), uvs[c].clone(), uvs[d].clone()]);
    
                    }
    
                }
    
                this.computeFaceNormals();
    
            };
    
            THREE.TorusGeometry.prototype = Object.create(THREE.Geometry.prototype);
        }
    
        var createCircleGeometry = function (radius, facing, arc) {
    
            var geometry = new THREE.Geometry();
            arc = arc ? arc : 1;
            for (var i = 0; i <= 64 * arc; ++i) {
                if (facing == 'x') geometry.vertices.push(new THREE.Vector3(0, Math.cos(i / 32 * Math.PI), Math.sin(i / 32 * Math.PI)).multiplyScalar(radius));
                if (facing == 'y') geometry.vertices.push(new THREE.Vector3(Math.cos(i / 32 * Math.PI), 0, Math.sin(i / 32 * Math.PI)).multiplyScalar(radius));
                if (facing == 'z') geometry.vertices.push(new THREE.Vector3(Math.sin(i / 32 * Math.PI), Math.cos(i / 32 * Math.PI), 0).multiplyScalar(radius));
            }
    
            return geometry;
        };
    
        var createArrowGeometry = function (radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded) {
    
            var arrowGeometry = new THREE.Geometry();
            var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded));
            mesh.position.y = 0.5;
            mesh.updateMatrix();
    
            arrowGeometry.merge(mesh.geometry, mesh.matrix);
    
            return arrowGeometry;
        };
    
        var createLineGeometry = function (axis) {
    
            var lineGeometry = new THREE.Geometry();
            if (axis === 'X')
                lineGeometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
            else if (axis === 'Y')
                lineGeometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
            else if (axis === 'Z')
                lineGeometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
    
            return lineGeometry;
        };
    
        THREE.TransformGizmo = function () {
    
            var scope = this;
            var showPickers = false; //debug
            var showActivePlane = false; //debug
    
            this.init = function () {
    
                THREE.Object3D.call(this);
    
                this.handles = new THREE.Object3D();
                this.pickers = new THREE.Object3D();
                this.planes = new THREE.Object3D();
                this.highlights = new THREE.Object3D();
                this.hemiPicker = new THREE.Object3D();
                this.subPickers = new THREE.Object3D();
    
                this.add(this.handles);
                this.add(this.pickers);
                this.add(this.planes);
                this.add(this.highlights);
                this.add(this.hemiPicker);
                this.add(this.subPickers);
    
                //// PLANES
    
                var planeGeometry = new THREE.PlaneBufferGeometry(50, 50, 2, 2);
                var planeMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
                planeMaterial.side = THREE.DoubleSide;
    
                var planes = {
                    "XY": new THREE.Mesh(planeGeometry, planeMaterial),
                    "YZ": new THREE.Mesh(planeGeometry, planeMaterial),
                    "XZ": new THREE.Mesh(planeGeometry, planeMaterial),
                    "XYZE": new THREE.Mesh(planeGeometry, planeMaterial)
                };
    
                this.activePlane = planes["XYZE"];
    
                planes["YZ"].rotation.set(0, Math.PI / 2, 0);
                planes["XZ"].rotation.set(-Math.PI / 2, 0, 0);
    
                for (var i in planes) {
                    planes[i].name = i;
                    this.planes.add(planes[i]);
                    this.planes[i] = planes[i];
                    planes[i].visible = false;
                }
    
                this.setupGizmos();
                this.activeMode = "";
    
                // reset Transformations
    
                this.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        child.updateMatrix();
    
                        var tempGeometry = new THREE.Geometry();
                        if (child.geometry instanceof THREE.BufferGeometry) {
                            child.geometry = new THREE.Geometry().fromBufferGeometry(child.geometry);
                        }
                        tempGeometry.merge(child.geometry, child.matrix);
    
                        child.geometry = tempGeometry;
                        child.position.set(0, 0, 0);
                        child.rotation.set(0, 0, 0);
                        child.scale.set(1, 1, 1);
                    }
                });
    
            };
    
            this.hide = function () {
                this.traverse(function (child) {
                    child.visible = false;
                });
            };
    
            this.show = function () {
                this.traverse(function (child) {
                    child.visible = true;
                    if (child.parent == scope.pickers || child.parent == scope.hemiPicker) child.visible = showPickers;
                    if (child.parent == scope.planes) child.visible = false;
                });
                this.activePlane.visible = showActivePlane;
            };
    
            this.highlight = function (axis) {
                this.traverse(function (child) {
                    if (child.material && child.material.highlight) {
                        if (child.name == axis) {
                            child.material.highlight(true);
                        } else {
                            child.material.highlight(false);
                        }
                    }
                });
            };
    
            this.setupGizmos = function () {
    
                var addGizmos = function (gizmoMap, parent) {
    
                    for (var name in gizmoMap) {
    
                        for (var i = gizmoMap[name].length; i--;) {
    
                            var object = gizmoMap[name][i][0];
                            var position = gizmoMap[name][i][1];
                            var rotation = gizmoMap[name][i][2];
                            var visble = gizmoMap[name][i][3];
    
                            object.name = name;
    
                            if (position) object.position.set(position[0], position[1], position[2]);
                            if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
                            if (visble) object.visble = visble;
    
                            parent.add(object);
    
                        }
    
                    }
    
                };
    
                this.setHandlePickerGizmos();
    
                addGizmos(this.handleGizmos, this.handles);
                addGizmos(this.pickerGizmos, this.pickers);
                addGizmos(this.highlightGizmos, this.highlights);
                addGizmos(this.hemiPickerGizmos, this.hemiPicker);
                addGizmos(this.subPickerGizmos, this.subPickers);
    
                this.hide();
                this.show();
    
            };
    
        };
    
        THREE.TransformGizmo.prototype = Object.create(THREE.Object3D.prototype);
    
        THREE.TransformGizmo.prototype.update = function (rotation, eye) {
    
            var vec1 = new THREE.Vector3(0, 0, 0);
            var vec2 = new THREE.Vector3(0, 1, 0);
            var lookAtMatrix = new THREE.Matrix4();
    
            this.traverse(function (child) {
                if (child.name) {
                    if (child.name.search("E") != -1) {
                        child.quaternion.setFromRotationMatrix(lookAtMatrix.lookAt(eye, vec1, vec2));
                    } else if (child.name.search("X") != -1 || child.name.search("Y") != -1 || child.name.search("Z") != -1) {
                        child.quaternion.setFromEuler(rotation);
                    }
                }
            });
    
        };
    
        THREE.TransformGizmoTranslate = function () {
    
            THREE.TransformGizmo.call(this);
    
            this.setHandlePickerGizmos = function () {
    
                var arrowGeometry = createArrowGeometry(0, 0.05, 0.2, 12, 1, false);
                var lineXGeometry = createLineGeometry('X');
                var lineYGeometry = createLineGeometry('Y');
                var lineZGeometry = createLineGeometry('Z');
    
                this.handleGizmos = {
                    X: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0xf12c2c })), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
                        [new THREE.Line(lineXGeometry, new GizmoLineMaterial({ color: 0xf12c2c }))]
                    ],
                    Y: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0x0bb80b })), [0, 0.5, 0]],
                        [new THREE.Line(lineYGeometry, new GizmoLineMaterial({ color: 0x0bb80b }))]
                    ],
                    Z: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0x2c2cf1 })), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
                        [new THREE.Line(lineZGeometry, new GizmoLineMaterial({ color: 0x2c2cf1 }))]
                    ],
                    XYZ: [
                        [new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new GizmoMaterial({ color: 0xffffff, opacity: 0.25 })), [0, 0, 0], [0, 0, 0]]
                    ],
                    XY: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.29, 0.29), new GizmoMaterial({ color: 0xffff00, opacity: 0.25 })), [0.15, 0.15, 0]]
                    ],
                    YZ: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.29, 0.29), new GizmoMaterial({ color: 0x00ffff, opacity: 0.25 })), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]
                    ],
                    XZ: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.29, 0.29), new GizmoMaterial({ color: 0xff00ff, opacity: 0.25 })), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]
                    ]
                };
    
                this.pickerGizmos = {
                    X: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0xff0000, opacity: 0.25 })), [0.6, 0, 0], [0, 0, -Math.PI / 2]]
                    ],
                    Y: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0x00ff00, opacity: 0.25 })), [0, 0.6, 0]]
                    ],
                    Z: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
                    ],
                    XYZ: [
                        [new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new GizmoMaterial({ color: 0xffffff, opacity: 0.25 }))]
                    ],
                    XY: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.4, 0.4), new GizmoMaterial({ color: 0xffff00, opacity: 0.25 })), [0.2, 0.2, 0]]
                    ],
                    YZ: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.4, 0.4), new GizmoMaterial({ color: 0x00ffff, opacity: 0.25 })), [0, 0.2, 0.2], [0, Math.PI / 2, 0]]
                    ],
                    XZ: [
                        [new THREE.Mesh(new THREE.PlaneBufferGeometry(0.4, 0.4), new GizmoMaterial({ color: 0xff00ff, opacity: 0.25 })), [0.2, 0, 0.2], [-Math.PI / 2, 0, 0]]
                    ]
                };
    
                this.hemiPickerGizmos = {
                    XYZ: [
                        [new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new GizmoMaterial({ color: 0x0000ff })), [0.5, 0.5, 0.5], null, false]
                    ]
                };
    
            };
    
            this.setActivePlane = function (axis, eye) {
    
                var tempMatrix = new THREE.Matrix4();
                eye.applyMatrix4(tempMatrix.getInverse(tempMatrix.extractRotation(this.planes["XY"].matrixWorld)));
    
                if (axis == "X") {
                    this.activePlane = this.planes["XY"];
                    if (Math.abs(eye.y) > Math.abs(eye.z)) this.activePlane = this.planes["XZ"];
                }
    
                if (axis == "Y") {
                    this.activePlane = this.planes["XY"];
                    if (Math.abs(eye.x) > Math.abs(eye.z)) this.activePlane = this.planes["YZ"];
                }
    
                if (axis == "Z") {
                    this.activePlane = this.planes["XZ"];
                    if (Math.abs(eye.x) > Math.abs(eye.y)) this.activePlane = this.planes["YZ"];
                }
    
                if (axis == "XYZ") this.activePlane = this.planes["XYZE"];
    
                if (axis == "XY") this.activePlane = this.planes["XY"];
    
                if (axis == "YZ") this.activePlane = this.planes["YZ"];
    
                if (axis == "XZ") this.activePlane = this.planes["XZ"];
    
                this.hide();
                this.show();
    
            };
    
            this.init();
    
        };
    
        THREE.TransformGizmoTranslate.prototype = Object.create(THREE.TransformGizmo.prototype);
    
        THREE.TransformGizmoRotate = function () {
    
            THREE.TransformGizmo.call(this);
    
            this.setHandlePickerGizmos = function () {
    
                this.handleGizmos = {
                    RX: [
                        [new THREE.Line(createCircleGeometry(1, 'x', 0.5), new GizmoLineMaterial({ color: 0xff0000 }))]
                    ],
                    RY: [
                        [new THREE.Line(createCircleGeometry(1, 'y', 0.5), new GizmoLineMaterial({ color: 0x00ff00 }))]
                    ],
                    RZ: [
                        [new THREE.Line(createCircleGeometry(1, 'z', 0.5), new GizmoLineMaterial({ color: 0x0000ff }))]
                    ],
                    RE: [
                        [new THREE.Line(createCircleGeometry(1.25, 'z', 1), new GizmoLineMaterial({ color: 0x00ffff }))]
                    ],
                    RXYZE: [
                        [new THREE.Line(createCircleGeometry(1, 'z', 1), new GizmoLineMaterial({ color: 0xff00ff }))]
                    ]
                };
    
                this.pickerGizmos = {
                    RX: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 12, Math.PI), new GizmoMaterial({ color: 0xff0000, opacity: 0.25 })), [0, 0, 0], [0, -Math.PI / 2, -Math.PI / 2]]
                    ],
                    RY: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 12, Math.PI), new GizmoMaterial({ color: 0x00ff00, opacity: 0.25 })), [0, 0, 0], [Math.PI / 2, 0, 0]]
                    ],
                    RZ: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 12, Math.PI), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0], [0, 0, -Math.PI / 2]]
                    ],
                    RE: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 2, 24), new GizmoMaterial({ color: 0x00ffff, opacity: 0.25 }))]
                    ],
                    RXYZE: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 2, 24), new GizmoMaterial({ color: 0xff00ff, opacity: 0.25 }))]
                    ]
                };
    
            };
    
            this.setActivePlane = function (axis) {
    
                if (axis == "RE") this.activePlane = this.planes["XYZE"];
    
                if (axis == "RX") this.activePlane = this.planes["YZ"];
    
                if (axis == "RY") this.activePlane = this.planes["XZ"];
    
                if (axis == "RZ") this.activePlane = this.planes["XY"];
    
                this.hide();
                this.show();
    
            };
    
            this.update = function (rotation, eye2) {
    
                THREE.TransformGizmo.prototype.update.apply(this, arguments);
    
                var tempMatrix = new THREE.Matrix4();
                var worldRotation = new THREE.Euler(0, 0, 1);
                var tempQuaternion = new THREE.Quaternion();
                var unitX = new THREE.Vector3(1, 0, 0);
                var unitY = new THREE.Vector3(0, 1, 0);
                var unitZ = new THREE.Vector3(0, 0, 1);
                var quaternionX = new THREE.Quaternion();
                var quaternionY = new THREE.Quaternion();
                var quaternionZ = new THREE.Quaternion();
                var eye = eye2.clone();
    
                worldRotation.copy(this.planes["XY"].rotation);
                tempQuaternion.setFromEuler(worldRotation);
    
                tempMatrix.makeRotationFromQuaternion(tempQuaternion).getInverse(tempMatrix);
                eye.applyMatrix4(tempMatrix);
    
                this.traverse(function (child) {
    
                    tempQuaternion.setFromEuler(worldRotation);
    
                    if (child.name == "RX") {
                        quaternionX.setFromAxisAngle(unitX, Math.atan2(-eye.y, eye.z));
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionX);
                        child.quaternion.copy(tempQuaternion);
                    }
    
                    if (child.name == "RY") {
                        quaternionY.setFromAxisAngle(unitY, Math.atan2(eye.x, eye.z));
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionY);
                        child.quaternion.copy(tempQuaternion);
                    }
    
                    if (child.name == "RZ") {
                        quaternionZ.setFromAxisAngle(unitZ, Math.atan2(eye.y, eye.x));
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionZ);
                        child.quaternion.copy(tempQuaternion);
                    }
    
                });
    
            };
    
            this.init();
    
        };
    
        THREE.TransformGizmoRotate.prototype = Object.create(THREE.TransformGizmo.prototype);
    
        THREE.TransformGizmoTranslateRotate = function () {
    
            THREE.TransformGizmo.call(this);
    
            var scope = this;
    
            this.setHandlePickerGizmos = function () {
    
                var arrowGeometry = createArrowGeometry(0, 0.05, 0.2, 12, 1, false);
                var lineGeometry = new THREE.Geometry();
                lineGeometry.vertices.push(new THREE.Vector3(0, 0, -0.1), new THREE.Vector3(0, 0, 0.1), new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(0.1, 0, 0));
                var theta = 0.15;
    
                this.handleGizmos = {
                    Z: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0xffffff })), [0, 0, 0.25], [Math.PI / 2, 0, 0]],
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4, 1, false), new GizmoMaterial({ color: 0xffffff })), [0, 0, 0.5], [Math.PI / 2, 0, 0]]
                    ],
                    RX: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.015, 12, 60, theta * 2 * Math.PI), new GizmoMaterial({ color: 0xff0000 })), [0, 0, 0], [theta * Math.PI, -Math.PI / 2, 0]],
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 60, 1, false), new GizmoMaterial({ color: 0xff0000 })), [0, 0, 1], [Math.PI / 2, 0, 0]]
                    ],
                    RY: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.015, 12, 60, theta * 2 * Math.PI), new GizmoMaterial({ color: 0x0000ff })), [0, 0, 0], [Math.PI / 2, 0, (0.5 - theta) * Math.PI]],
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 60, 1, false), new GizmoMaterial({ color: 0x0000ff })), [0, 0, 1]]
                    ]
                };
    
                this.pickerGizmos = {
                    Z: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.65, 4, 1, false), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0.5], [Math.PI / 2, 0, 0]]
                    ],
                    RX: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 12, theta * 2 * Math.PI), new GizmoMaterial({ color: 0xff0000, opacity: 0.25 })), [0, 0, 0], [theta * Math.PI, -Math.PI / 2, 0]]
                    ],
                    RY: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 4, 12, theta * 2 * Math.PI), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0], [Math.PI / 2, 0, (0.5 - theta) * Math.PI]]
                    ]
                };
    
                this.subPickerGizmos = {
                    Z: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.65, 4, 1, false), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0.5], [Math.PI / 2, 0, 0]]
                    ]
                };
    
                this.highlightGizmos = {
                    Z: [
                    ],
                    RX: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 12, 60, 2 * Math.PI), new GizmoMaterial({ color: 0xff0000, opacity: 1 })), [0, 0, 0], [0, -Math.PI / 2, -Math.PI / 2], false]
                    ],
                    RY: [
                        [new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 12, 60, 2 * Math.PI), new GizmoMaterial({ color: 0x0000ff, opacity: 1 })), [0, 0, 0], [Math.PI / 2, 0, 0], false]
                    ]
                };
    
                this.hemiPickerGizmos = {
                    XYZ: [
                        [new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8, 0, Math.PI), new GizmoMaterial({ color: 0x0000ff })), null, null, false]
                    ]
                };
    
            };
    
            this.setActivePlane = function (axis, eye) {
    
                if (this.activeMode == "translate") {
    
                    var tempMatrix = new THREE.Matrix4();
                    eye.applyMatrix4(tempMatrix.getInverse(tempMatrix.extractRotation(this.planes["XY"].matrixWorld)));
    
                    if (axis == "X") {
                        this.activePlane = this.planes["XY"];
                        if (Math.abs(eye.y) > Math.abs(eye.z)) this.activePlane = this.planes["XZ"];
                    }
    
                    if (axis == "Y") {
                        this.activePlane = this.planes["XY"];
                        if (Math.abs(eye.x) > Math.abs(eye.z)) this.activePlane = this.planes["YZ"];
                    }
    
                    if (axis == "Z") {
                        this.activePlane = this.planes["XZ"];
                        if (Math.abs(eye.x) > Math.abs(eye.y)) this.activePlane = this.planes["YZ"];
                    }
    
                } else if (this.activeMode == "rotate") {
    
                    if (axis == "RX") this.activePlane = this.planes["YZ"];
    
                    if (axis == "RY") this.activePlane = this.planes["XZ"];
    
                    if (axis == "RZ") this.activePlane = this.planes["XY"];
    
                }
    
                this.hide();
                this.show();
    
            };
    
            this.update = function (rotation, eye2) {
    
                if (this.activeMode == "translate") {
    
                    THREE.TransformGizmo.prototype.update.apply(this, arguments);
    
                } else if (this.activeMode == "rotate") {
    
                    THREE.TransformGizmo.prototype.update.apply(this, arguments);
    
                    var tempMatrix = new THREE.Matrix4();
                    var worldRotation = new THREE.Euler(0, 0, 1);
                    var tempQuaternion = new THREE.Quaternion();
                    var unitX = new THREE.Vector3(1, 0, 0);
                    var unitY = new THREE.Vector3(0, 1, 0);
                    var unitZ = new THREE.Vector3(0, 0, 1);
                    var quaternionX = new THREE.Quaternion();
                    var quaternionY = new THREE.Quaternion();
                    var quaternionZ = new THREE.Quaternion();
                    var eye = eye2.clone();
    
                    worldRotation.copy(this.planes["XY"].rotation);
                    tempQuaternion.setFromEuler(worldRotation);
    
                    tempMatrix.makeRotationFromQuaternion(tempQuaternion).getInverse(tempMatrix);
                    eye.applyMatrix4(tempMatrix);
    
                    this.traverse(function (child) {
    
                        tempQuaternion.setFromEuler(worldRotation);
    
                        if (child.name == "RX") {
                            quaternionX.setFromAxisAngle(unitX, Math.atan2(-eye.y, eye.z));
                            tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionX);
                            child.quaternion.copy(tempQuaternion);
                        }
    
                        if (child.name == "RY") {
                            quaternionY.setFromAxisAngle(unitY, Math.atan2(eye.x, eye.z));
                            tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionY);
                            child.quaternion.copy(tempQuaternion);
                        }
    
                        if (child.name == "RZ") {
                            quaternionZ.setFromAxisAngle(unitZ, Math.atan2(eye.y, eye.x));
                            tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionZ);
                            child.quaternion.copy(tempQuaternion);
                        }
    
                    });
    
                }
    
            };
    
            this.show = function () {
                this.traverse(function (child) {
                    if (scope.parent == null || (scope.parent.useAllPickers || child.parent != scope.handles)) child.visible = true;
                    if (child.material) child.material.opacity = child.material.oldOpacity;
                    if (child.parent == scope.pickers || child.parent == scope.hemiPicker || child.parent == scope.subPickers) child.visible = false;
                    if (child.parent == scope.planes || child.parent == scope.highlights) child.visible = false;
                });
                this.activePlane.visible = false;
            };
    
            this.highlight = function (axis) {
                this.traverse(function (child) {
                    if (child.material && child.material.highlight) {
                        if (child.name == axis) {
                            if (child.parent == scope.highlights || child.parent == scope.handles) child.visible = true;
                            child.material.highlight(true);
                        } else {
                            child.material.highlight(false);
                            child.material.opacity = 0.1;
                        }
                    }
                });
            };
    
            this.init();
    
        };
    
        THREE.TransformGizmoTranslateRotate.prototype = Object.create(THREE.TransformGizmo.prototype);
    
        THREE.TransformGizmoScale = function () {
    
            THREE.TransformGizmo.call(this);
    
            this.setHandlePickerGizmos = function () {
    
                var arrowGeometry = createArrowGeometry(0.125, 0.125, 0.125);
                var lineXGeometry = createLineGeometry('X');
                var lineYGeometry = createLineGeometry('Y');
                var lineZGeometry = createLineGeometry('Z');
    
                this.handleGizmos = {
                    X: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0xff0000 })), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
                        [new THREE.Line(lineXGeometry, new GizmoLineMaterial({ color: 0xff0000 }))]
                    ],
                    Y: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0x00ff00 })), [0, 0.5, 0]],
                        [new THREE.Line(lineYGeometry, new GizmoLineMaterial({ color: 0x00ff00 }))]
                    ],
                    Z: [
                        [new THREE.Mesh(arrowGeometry, new GizmoMaterial({ color: 0x0000ff })), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
                        [new THREE.Line(lineZGeometry, new GizmoLineMaterial({ color: 0x0000ff }))]
                    ],
                    XYZ: [
                        [new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.125), new GizmoMaterial({ color: 0xffffff, opacity: 0.25 }))]
                    ]
                };
    
                this.pickerGizmos = {
                    X: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0xff0000, opacity: 0.25 })), [0.6, 0, 0], [0, 0, -Math.PI / 2]]
                    ],
                    Y: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0x00ff00, opacity: 0.25 })), [0, 0.6, 0]]
                    ],
                    Z: [
                        [new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0, 1, 4, 1, false), new GizmoMaterial({ color: 0x0000ff, opacity: 0.25 })), [0, 0, 0.6], [Math.PI / 2, 0, 0]]
                    ],
                    XYZ: [
                        [new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new GizmoMaterial({ color: 0xffffff, opacity: 0.25 }))]
                    ]
                };
    
            };
    
            this.setActivePlane = function (axis, eye) {
    
                var tempMatrix = new THREE.Matrix4();
                eye.applyMatrix4(tempMatrix.getInverse(tempMatrix.extractRotation(this.planes["XY"].matrixWorld)));
    
                if (axis == "X") {
                    this.activePlane = this.planes["XY"];
                    if (Math.abs(eye.y) > Math.abs(eye.z)) this.activePlane = this.planes["XZ"];
                }
    
                if (axis == "Y") {
                    this.activePlane = this.planes["XY"];
                    if (Math.abs(eye.x) > Math.abs(eye.z)) this.activePlane = this.planes["YZ"];
                }
    
                if (axis == "Z") {
                    this.activePlane = this.planes["XZ"];
                    if (Math.abs(eye.x) > Math.abs(eye.y)) this.activePlane = this.planes["YZ"];
                }
    
                if (axis == "XYZ") this.activePlane = this.planes["XYZE"];
    
                this.hide();
                this.show();
    
            };
    
            this.init();
    
        };
    
        THREE.TransformGizmoScale.prototype = Object.create(THREE.TransformGizmo.prototype);
    
        THREE.TransformControls = function (camera, domElement, mode) {
    
            // TODO: Make non-uniform scale and rotate play nice in hierarchies
            // TODO: ADD RXYZ contol
    
            THREE.Object3D.call(this);
    
            domElement = (domElement !== undefined) ? domElement : document;
    
            this.gizmo = {};
            switch (mode) {
                case "translate":
                    this.gizmo[mode] = new THREE.TransformGizmoTranslate();
                    break;
                case "rotate":
                    this.gizmo[mode] = new THREE.TransformGizmoRotate();
                    break;
                case "transrotate":
                    this.gizmo[mode] = new THREE.TransformGizmoTranslateRotate();
                    break;
                case "scale":
                    this.gizmo[mode] = new THREE.TransformGizmoScale();
                    break;
            }
    
            this.add(this.gizmo[mode]);
            this.gizmo[mode].hide();
    
            this.object = undefined;
            this.snap = null;
            this.snapDelta = 0;
            this.space = "world";
            this.size = 1;
            this.axis = null;
            this.useAllPickers = true;
    
            this.unitX = new THREE.Vector3(1, 0, 0);
            this.unitY = new THREE.Vector3(0, 1, 0);
            this.unitZ = new THREE.Vector3(0, 0, 1);
            this.normal = new THREE.Vector3(0, 0, 1);
    
            if (mode === "transrotate") {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
                var material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, depthTest: false });
                this.startLine = new THREE.Line(geometry, material);
                var geometry = new THREE.Geometry();
                var material = new THREE.LineBasicMaterial({ color: 0xffe603, linewidth: 2, depthTest: false });
                geometry.vertices.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
                this.endLine = new THREE.Line(geometry, material);
                var geometry = new THREE.Geometry();
                var material = new THREE.LineDashedMaterial({ color: 0x000000, linewidth: 1, depthTest: false });
                geometry.vertices.push(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0));
                this.centerLine = new THREE.Line(geometry, material);
    
                var map = THREE.ImageUtils.loadTexture(getResourceUrl("res/textures/centerMarker_X.png"));
                map.magFilter = map.minFilter = THREE.NearestFilter;
                var geometry = new THREE.CircleGeometry(0.1, 32);
                var material = new THREE.MeshBasicMaterial({ opacity: 1, side: THREE.DoubleSide, transparent: true, map: map });
                this.centerMark = new THREE.Mesh(geometry, material);
                this.centerMark.rotation.set(Math.PI / 2, 0, 0);
    
                this.ticks = {};
                var map = THREE.ImageUtils.loadTexture(getResourceUrl("res/textures/cardinalPoint.png"));
                map.magFilter = map.minFilter = THREE.NearestFilter;
                var material = new THREE.MeshBasicMaterial({ depthTest: false, opacity: 1, transparent: true, side: THREE.DoubleSide, map: map });
                var w = 0.12, h = 0.25, d = 1.15;
    
                this.ticks["RX"] = new THREE.Object3D();
                var geometry = new THREE.PlaneBufferGeometry(w, h);
                var mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(0, 0, -d - h / 2);
                mesh.rotation.set(Math.PI / 2, Math.PI / 2, 0);
                this.ticks["RX"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(0, d + h / 2, 0);
                mesh.rotation.set(0, Math.PI / 2, 0);
                this.ticks["RX"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(0, 0, d + h / 2);
                mesh.rotation.set(0, Math.PI / 2, Math.PI / 2);
                this.ticks["RX"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(0, -d - h / 2, 0);
                mesh.rotation.set(0, Math.PI / 2, 0);
                this.ticks["RX"].add(mesh);
    
                this.ticks["RY"] = new THREE.Object3D();
                mesh = mesh.clone();
                mesh.position.set(0, 0, -d - h / 2);
                mesh.rotation.set(Math.PI / 2, 0, 0);
                this.ticks["RY"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(-d - h / 2, 0, 0);
                mesh.rotation.set(Math.PI / 2, 0, Math.PI / 2);
                this.ticks["RY"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(0, 0, d + h / 2);
                mesh.rotation.set(Math.PI / 2, 0, 0);
                this.ticks["RY"].add(mesh);
    
                mesh = mesh.clone();
                mesh.position.set(d + h / 2, 0, 0);
                mesh.rotation.set(Math.PI / 2, 0, Math.PI / 2);
                this.ticks["RY"].add(mesh);
            }
    
            var scope = this;
    
            var _dragging = false;
            var _mode = mode;
            var _plane = "XY";
    
            var changeEvent = { type: "change" };
            var mouseDownEvent = { type: "mouseDown" };
            var mouseUpEvent = { type: "mouseUp", mode: _mode };
            var objectChangeEvent = { type: "objectChange" };
    
            var ray = new THREE.Raycaster();
            var pointerVector = new THREE.Vector3();
            var pointerDir = new THREE.Vector3();
    
            var point = new THREE.Vector3();
            var offset = new THREE.Vector3();
    
            var rotation = new THREE.Vector3();
            var offsetRotation = new THREE.Vector3();
            var scale = 1;
    
            var lookAtMatrix = new THREE.Matrix4();
            var eye = new THREE.Vector3();
    
            var tempMatrix = new THREE.Matrix4();
            var tempVector = new THREE.Vector3();
            var tempQuaternion = new THREE.Quaternion();
            var projX = new THREE.Vector3();
            var projY = new THREE.Vector3();
            var projZ = new THREE.Vector3();
    
            var quaternionXYZ = new THREE.Quaternion();
            var quaternionX = new THREE.Quaternion();
            var quaternionY = new THREE.Quaternion();
            var quaternionZ = new THREE.Quaternion();
            var quaternionE = new THREE.Quaternion();
    
            var oldPosition = new THREE.Vector3();
            var oldScale = new THREE.Vector3();
            var oldRotationMatrix = new THREE.Matrix4();
    
            var parentRotationMatrix = new THREE.Matrix4();
            var parentScale = new THREE.Vector3();
    
            var worldPosition = new THREE.Vector3();
            var worldRotation = new THREE.Euler();
            var worldRotationMatrix = new THREE.Matrix4();
            var camPosition = new THREE.Vector3();
            var camRotation = new THREE.Euler();
    
            this.attach = function (object) {
    
                scope.object = object;
    
                this.gizmo[_mode].show();
    
                scope.update();
    
                scope.updateUnitVectors();
    
            };
    
            this.detach = function (object) {
    
                scope.object = undefined;
                this.axis = null;
    
                this.gizmo[_mode].hide();
    
            };
    
            this.setMode = function (mode) {
    
                _mode = mode ? mode : _mode;
    
                if (_mode == "scale") scope.space = "local";
    
                this.gizmo[_mode].show();
    
                this.update();
                scope.dispatchEvent(changeEvent);
    
            };
    
            this.getPicker = function () {
    
                return scope.gizmo[_mode].hemiPicker.children;
    
            };
    
            this.setPosition = function (position) {
    
                this.object.position.copy(position);
                this.update();
    
            };
    
            this.setNormal = function (normal) {
    
                tempQuaternion.setFromUnitVectors(this.normal, normal);
                this.unitX.applyQuaternion(tempQuaternion);
                this.unitY.applyQuaternion(tempQuaternion);
                this.unitZ.applyQuaternion(tempQuaternion);
                this.normal.copy(normal);
                if (this.object) {
                    this.object.quaternion.multiply(tempQuaternion);
                }
                this.update();
            };
    
            this.setSnap = function (snap, delta) {
    
                scope.snap = snap;
                scope.snapDelta = delta;
    
            };
    
            this.setSize = function (size) {
    
                scope.size = size;
                this.update();
                scope.dispatchEvent(changeEvent);
    
            };
    
            this.setSpace = function (space) {
    
                scope.space = space;
                this.update();
                scope.dispatchEvent(changeEvent);
    
            };
    
            this.update = function (highlight) {
    
                if (scope.object === undefined) return;
    
                scope.object.updateMatrixWorld();
                worldPosition.setFromMatrixPosition(scope.object.matrixWorld);
                worldRotation.setFromRotationMatrix(tempMatrix.extractRotation(scope.object.matrixWorld));
    
                camera.updateMatrixWorld();
                camPosition.setFromMatrixPosition(camera.matrixWorld);
                //camRotation.setFromRotationMatrix( tempMatrix.extractRotation( camera.matrixWorld ) );
    
                this.position.copy(worldPosition);
    
                this.quaternion.setFromEuler(worldRotation);
    
                this.normal.set(0, 0, 1);
                this.normal.applyEuler(worldRotation);
    
                // keep same screen height (100px)
                var dist = worldPosition.distanceTo(camPosition);
                var height = camera.isPerspective ? 2 * Math.tan(camera.fov * Math.PI / 360) * dist : dist;
                var rect = domElement.getBoundingClientRect();
                scale = 100 * height / rect.height;
                this.scale.set(scale, scale, scale);
    
                //eye.copy( camPosition ).sub( worldPosition ).normalize();
    
                //if ( scope.space == "local" )
                //    this.gizmo[_mode].update( worldRotation, eye );
                //else if ( scope.space == "world" )
                //    this.gizmo[_mode].update( new THREE.Euler(), eye );
    
                if (highlight)
                    this.gizmo[_mode].highlight(scope.axis);
    
            };
    
            this.updateUnitVectors = function () {
    
                this.unitX.set(1, 0, 0);
                this.unitY.set(0, 1, 0);
                this.unitZ.set(0, 0, 1);
                this.unitX.applyEuler(worldRotation);
                this.unitY.applyEuler(worldRotation);
                this.unitZ.applyEuler(worldRotation);
    
            };
    
            this.showRotationGizmos = function (set) {
    
                var handles = this.gizmo[_mode].handles.children;
                for (var i = 0; i < handles.length; i++) {
                    var child = handles[i];
                    child.visible = true;
                    if (child.name.search("R") !== -1) child.visible = set;
                }
                this.useAllPickers = set;
    
            };
    
            this.highlight = function () {
    
                this.gizmo[_mode].highlight(this.axis || "Z");
    
            };
    
            this.onPointerHover = function (event) {
    
                if (scope.object === undefined || _dragging === true) return false;
    
                var pointer = event.pointers ? event.pointers[0] : event;
    
                var intersect = intersectObjects(pointer, scope.useAllPickers ? scope.gizmo[_mode].pickers.children : scope.gizmo[_mode].subPickers.children);
    
                var axis = null;
                var mode = "";
    
                if (intersect) {
    
                    axis = intersect.object.name;
                    mode = axis.search("R") != -1 ? "rotate" : "translate";
    
                }
    
                if (scope.axis !== axis) {
    
                    scope.axis = axis;
                    scope.gizmo[_mode].activeMode = mode;
                    scope.update(true);
                    scope.dispatchEvent(changeEvent);
    
                }
    
                if (scope.axis === null) {
    
                    scope.gizmo[_mode].show();
    
                }
    
                return intersect ? true : false;
    
            }
    
            this.onPointerDown = function (event) {
    
                if (scope.object === undefined || _dragging === true) return false;
    
                var pointer = event.pointers ? event.pointers[0] : event;
    
                if (event.pointerType === 'touch') {
    
                    var intersect = intersectObjects(pointer, scope.useAllPickers ? scope.gizmo[_mode].pickers.children : scope.gizmo[_mode].subPickers.children);
    
                    var axis = null;
                    var mode = "";
    
                    if (intersect) {
    
                        axis = intersect.object.name;
                        mode = axis.search("R") != -1 ? "rotate" : "translate";
    
                    }
    
                    if (scope.axis !== axis) {
    
                        scope.axis = axis;
                        scope.gizmo[_mode].activeMode = mode;
                    }
                }
    
                var intersect = null;
    
                if (pointer.button === 0 || pointer.button === undefined) {
    
                    intersect = intersectObjects(pointer, scope.useAllPickers ? scope.gizmo[_mode].pickers.children : scope.gizmo[_mode].subPickers.children);
    
                    if (intersect) {
    
                        scope.dispatchEvent(mouseDownEvent);
    
                        scope.axis = intersect.object.name;
    
                        scope.update();
    
                        eye.copy(camera.position).sub(worldPosition).normalize();
    
                        scope.gizmo[_mode].setActivePlane(scope.axis, eye);
    
                        var planeIntersect = intersectObjects(pointer, [scope.gizmo[_mode].activePlane]);
    
                        if (planeIntersect)
                            offset.copy(planeIntersect.point);
    
                        oldPosition.copy(scope.object.position);
                        oldScale.copy(scope.object.scale);
    
                        oldRotationMatrix.extractRotation(scope.object.matrix);
                        worldRotationMatrix.extractRotation(scope.object.matrixWorld);
    
                        if (scope.object.parent) {
                            parentRotationMatrix.extractRotation(scope.object.parent.matrixWorld);
                            parentScale.setFromMatrixScale(tempMatrix.getInverse(scope.object.parent.matrixWorld));
                        } else {
                            parentRotationMatrix.extractRotation(scope.object.matrixWorld);
                            parentScale.setFromMatrixScale(tempMatrix.getInverse(scope.object.matrixWorld));
                        }
    
                        // show rotation start line and ticks
                        if (_mode === "transrotate" && scope.gizmo[_mode].activeMode === "rotate") {
                            scope.startLine.geometry.vertices[0].set(0, 0, 0).applyMatrix4(scope.matrixWorld);
                            scope.startLine.geometry.vertices[1].set(0, 0, 1).applyMatrix4(scope.matrixWorld);
                            scope.startLine.geometry.verticesNeedUpdate = true;
                            scope.parent.add(scope.startLine);
    
                            var pos = scope.object.geometry.getAttribute('position');
                            var pt1 = new THREE.Vector3().fromAttribute(pos, 0).applyMatrix4(scope.object.matrixWorld);
                            var pt2 = new THREE.Vector3().fromAttribute(pos, 1).applyMatrix4(scope.object.matrixWorld);
                            var pt3 = new THREE.Vector3().fromAttribute(pos, 2).applyMatrix4(scope.object.matrixWorld);
                            var pt4 = new THREE.Vector3().fromAttribute(pos, 3).applyMatrix4(scope.object.matrixWorld);
                            if (scope.axis === "RX") {
                                pt1.lerp(pt3, 0.5);
                                pt2.lerp(pt4, 0.5);
                                var dist = pt1.distanceTo(pt2);
                                scope.centerLine.material.dashSize = dist / 15;
                                scope.centerLine.material.gapSize = dist / 30;
                                scope.centerLine.geometry.vertices[0].copy(pt1);
                                scope.centerLine.geometry.vertices[1].copy(pt2);
                            } else {
                                pt1.lerp(pt2, 0.5);
                                pt3.lerp(pt4, 0.5);
                                var dist = pt1.distanceTo(pt3);
                                scope.centerLine.material.dashSize = dist / 15;
                                scope.centerLine.material.gapSize = dist / 30;
                                scope.centerLine.geometry.vertices[0].copy(pt1);
                                scope.centerLine.geometry.vertices[1].copy(pt3);
                            }
                            scope.centerLine.geometry.computeLineDistances();
                            scope.centerLine.geometry.verticesNeedUpdate = true;
                            scope.parent.add(scope.centerLine);
    
                            scope.ticks[scope.axis].position.copy(scope.position);
                            scope.ticks[scope.axis].quaternion.copy(scope.quaternion);
                            scope.ticks[scope.axis].scale.copy(scope.scale);
                            scope.parent.add(scope.ticks[scope.axis]);
                        }
    
                    }
    
                }
    
                _dragging = true;
    
                return intersect ? true : false;
    
            }
    
            this.onPointerMove = function (event) {
    
                if (scope.object === undefined || scope.axis === null || _dragging === false) return false;
    
                var pointer = event.pointers ? event.pointers[0] : event;
    
                var planeIntersect = intersectObjects(pointer, [scope.gizmo[_mode].activePlane]);
    
                if (planeIntersect)
                    point.copy(planeIntersect.point);
    
                var mode = scope.gizmo[_mode].activeMode;
                if (mode == "translate") {
    
                    point.sub(offset);
                    point.multiply(parentScale);
    
                    if (scope.space == "local") {
    
                        point.applyMatrix4(tempMatrix.getInverse(worldRotationMatrix));
    
                        projX.copy(this.unitX);
                        projY.copy(this.unitY);
                        projZ.copy(this.unitZ);
                        tempVector.set(0, 0, 0);
                        if (scope.axis.search("X") != -1) {
                            projX.multiplyScalar(point.dot(this.unitX));
                            tempVector.add(projX);
                        }
                        if (scope.axis.search("Y") != -1) {
                            projY.multiplyScalar(point.dot(this.unitY));
                            tempVector.add(projY);
                        }
                        if (scope.axis.search("Z") != -1) {
                            projZ.multiplyScalar(point.dot(this.unitZ));
                            tempVector.add(projZ);
                        }
                        point.copy(tempVector);
    
                        point.applyMatrix4(oldRotationMatrix);
    
                        scope.object.position.copy(oldPosition);
                        scope.object.position.add(point);
    
                    }
    
                    if (scope.space == "world" || scope.axis.search("XYZ") != -1) {
    
                        projX.copy(this.unitX);
                        projY.copy(this.unitY);
                        projZ.copy(this.unitZ);
                        tempVector.set(0, 0, 0);
                        if (scope.axis.search("X") != -1) {
                            projX.multiplyScalar(point.dot(this.unitX));
                            tempVector.add(projX);
                        }
                        if (scope.axis.search("Y") != -1) {
                            projY.multiplyScalar(point.dot(this.unitY));
                            tempVector.add(projY);
                        }
                        if (scope.axis.search("Z") != -1) {
                            projZ.multiplyScalar(point.dot(this.unitZ));
                            tempVector.add(projZ);
                        }
                        point.copy(tempVector);
    
                        point.applyMatrix4(tempMatrix.getInverse(parentRotationMatrix));
    
                        scope.object.position.copy(oldPosition);
                        scope.object.position.add(point);
    
                    }
    
                } else if (mode == "scale") {
    
                    point.sub(offset);
                    point.multiply(parentScale);
    
                    if (scope.space == "local") {
    
                        if (scope.axis == "XYZ") {
    
                            scale = 1 + ((point.y) / 50);
    
                            scope.object.scale.x = oldScale.x * scale;
                            scope.object.scale.y = oldScale.y * scale;
                            scope.object.scale.z = oldScale.z * scale;
    
                        } else {
    
                            point.applyMatrix4(tempMatrix.getInverse(worldRotationMatrix));
    
                            if (scope.axis == "X") scope.object.scale.x = oldScale.x * (1 + point.x / 50);
                            if (scope.axis == "Y") scope.object.scale.y = oldScale.y * (1 + point.y / 50);
                            if (scope.axis == "Z") scope.object.scale.z = oldScale.z * (1 + point.z / 50);
    
                        }
    
                    }
    
                } else if (mode == "rotate") {
    
                    point.sub(worldPosition);
                    point.multiply(parentScale);
                    tempVector.copy(offset).sub(worldPosition);
                    tempVector.multiply(parentScale);
    
                    if (scope.axis == "RE") {
    
                        point.applyMatrix4(tempMatrix.getInverse(lookAtMatrix));
                        tempVector.applyMatrix4(tempMatrix.getInverse(lookAtMatrix));
    
                        rotation.set(Math.atan2(point.z, point.y), Math.atan2(point.x, point.z), Math.atan2(point.y, point.x));
                        offsetRotation.set(Math.atan2(tempVector.z, tempVector.y), Math.atan2(tempVector.x, tempVector.z), Math.atan2(tempVector.y, tempVector.x));
    
                        tempQuaternion.setFromRotationMatrix(tempMatrix.getInverse(parentRotationMatrix));
    
                        var rotz = rotation.z - offsetRotation.z;
                        if (scope.snap !== null) {
                            var rotsnap = Math.round(rotz / scope.snap) * scope.snap;
                            if (Math.abs(rotsnap - rotz) < scope.snapDelta) {
                                rotz = rotsnap;
                            }
                        }
                        quaternionE.setFromAxisAngle(eye, rotz);
                        quaternionXYZ.setFromRotationMatrix(worldRotationMatrix);
    
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionE);
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionXYZ);
    
                        scope.object.quaternion.copy(tempQuaternion);
    
                    } else if (scope.axis == "RXYZE") {
    
                        var tempAxis = point.clone().cross(tempVector).normalize(); // rotation axis
    
                        tempQuaternion.setFromRotationMatrix(tempMatrix.getInverse(parentRotationMatrix));
    
                        var rot = -point.clone().angleTo(tempVector);
                        if (scope.snap !== null) {
                            var rotsnap = Math.round(rot / scope.snap) * scope.snap;
                            if (Math.abs(rotsnap - rot) < scope.snapDelta) {
                                rot = rotsnap;
                            }
                        }
                        quaternionX.setFromAxisAngle(tempAxis, rot);
                        quaternionXYZ.setFromRotationMatrix(worldRotationMatrix);
    
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionX);
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionXYZ);
    
                        scope.object.quaternion.copy(tempQuaternion);
    
                    } else if (scope.space == "local") {
    
                        point.applyMatrix4(tempMatrix.getInverse(worldRotationMatrix));
    
                        tempVector.applyMatrix4(tempMatrix.getInverse(worldRotationMatrix));
    
                        var projx = point.dot(this.unitX), projy = point.dot(this.unitY), projz = point.dot(this.unitZ);
                        var tempx = tempVector.dot(this.unitX), tempy = tempVector.dot(this.unitY), tempz = tempVector.dot(this.unitZ);
                        rotation.set(Math.atan2(projz, projy), Math.atan2(projx, projz), Math.atan2(projy, projx));
                        offsetRotation.set(Math.atan2(tempz, tempy), Math.atan2(tempx, tempz), Math.atan2(tempy, tempx));
    
                        var rotx = rotation.x - offsetRotation.x;
                        var roty = rotation.y - offsetRotation.y;
                        var rotz = rotation.z - offsetRotation.z;
                        if (scope.snap !== null) {
                            if (scope.axis.search("X") != -1) {
                                var rotsnap = Math.round(rotx / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - rotx) < scope.snapDelta) {
                                    rotx = rotsnap;
                                }
                            }
                            if (scope.axis.search("Y") != -1) {
                                var rotsnap = Math.round(roty / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - roty) < scope.snapDelta) {
                                    roty = rotsnap;
                                }
                            }
                            if (scope.axis.search("Z") != -1) {
                                var rotsnap = Math.round(rotz / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - rotz) < scope.snapDelta) {
                                    rotz = rotsnap;
                                }
                            }
                        }
                        quaternionX.setFromAxisAngle(this.unitX, rotx);
                        quaternionY.setFromAxisAngle(this.unitY, roty);
                        quaternionZ.setFromAxisAngle(this.unitZ, rotz);
                        quaternionXYZ.setFromRotationMatrix(oldRotationMatrix);
    
                        if (scope.axis == "RX") quaternionXYZ.multiplyQuaternions(quaternionXYZ, quaternionX);
                        if (scope.axis == "RY") quaternionXYZ.multiplyQuaternions(quaternionXYZ, quaternionY);
                        if (scope.axis == "RZ") quaternionXYZ.multiplyQuaternions(quaternionXYZ, quaternionZ);
    
                        scope.object.quaternion.copy(quaternionXYZ);
    
                    } else if (scope.space == "world") {
    
                        var projx = point.dot(this.unitX), projy = point.dot(this.unitY), projz = point.dot(this.unitZ);
                        var tempx = tempVector.dot(this.unitX), tempy = tempVector.dot(this.unitY), tempz = tempVector.dot(this.unitZ);
                        rotation.set(Math.atan2(projz, projy), Math.atan2(projx, projz), Math.atan2(projy, projx));
                        offsetRotation.set(Math.atan2(tempz, tempy), Math.atan2(tempx, tempz), Math.atan2(tempy, tempx));
    
                        tempQuaternion.setFromRotationMatrix(tempMatrix.getInverse(parentRotationMatrix));
    
                        var rotx = rotation.x - offsetRotation.x;
                        var roty = rotation.y - offsetRotation.y;
                        var rotz = rotation.z - offsetRotation.z;
                        if (scope.snap !== null) {
                            if (scope.axis.search("X") != -1) {
                                var rotsnap = Math.round(rotx / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - rotx) < scope.snapDelta) {
                                    rotx = rotsnap;
                                }
                            }
                            if (scope.axis.search("Y") != -1) {
                                var rotsnap = Math.round(roty / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - roty) < scope.snapDelta) {
                                    roty = rotsnap;
                                }
                            }
                            if (scope.axis.search("Z") != -1) {
                                var rotsnap = Math.round(rotz / scope.snap) * scope.snap;
                                if (Math.abs(rotsnap - rotz) < scope.snapDelta) {
                                    rotz = rotsnap;
                                }
                            }
                        }
                        quaternionX.setFromAxisAngle(this.unitX, rotx);
                        quaternionY.setFromAxisAngle(this.unitY, roty);
                        quaternionZ.setFromAxisAngle(this.unitZ, rotz);
                        quaternionXYZ.setFromRotationMatrix(worldRotationMatrix);
    
                        if (scope.axis == "RX") tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionX);
                        if (scope.axis == "RY") tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionY);
                        if (scope.axis == "RZ") tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionZ);
    
                        tempQuaternion.multiplyQuaternions(tempQuaternion, quaternionXYZ);
    
                        scope.object.quaternion.copy(tempQuaternion);
    
                    }
    
                    // show rotation end line
                    if (_mode === "transrotate") {
                        scope.add(scope.endLine);
                        scope.add(scope.centerMark);
                    }
    
                }
    
                // update matrix
                scope.object.matrixAutoUpdate = true;
    
                scope.update(true);
                scope.dispatchEvent(changeEvent);
                scope.dispatchEvent(objectChangeEvent);
    
                return planeIntersect ? true : false;
    
            }
    
            this.onPointerUp = function (event) {
    
                if (_dragging && (scope.axis !== null)) {
                    mouseUpEvent.mode = _mode;
                    scope.dispatchEvent(mouseUpEvent)
                }
                _dragging = false;
    
                this.gizmo[_mode].show();
    
                this.updateUnitVectors();
    
                // remove rotation start/end lines
                if (_mode === "transrotate" && this.gizmo[_mode].activeMode === "rotate") {
                    this.remove(this.endLine);
                    this.remove(this.centerMark);
                    this.parent.remove(this.centerLine);
                    this.parent.remove(this.startLine);
                    this.parent.remove(this.ticks[this.axis]);
                }
    
                return false;
    
            }
    
            function intersectObjects(pointer, objects) {
    
                var rect = domElement.getBoundingClientRect();
                var x = ((pointer.clientX - rect.left) / rect.width) * 2 - 1;
                var y = -((pointer.clientY - rect.top) / rect.height) * 2 + 1;
    
                if (camera.isPerspective) {
                    pointerVector.set(x, y, 0.5);
                    pointerVector.unproject(camera);
                    ray.set(camera.position, pointerVector.sub(camera.position).normalize());
                } else {
                    pointerVector.set(x, y, -1);
                    pointerVector.unproject(camera);
                    pointerDir.set(0, 0, -1);
                    ray.set(pointerVector, pointerDir.transformDirection(camera.matrixWorld));
                }
    
                var intersections = ray.intersectObjects(objects, true);
                return intersections[0] ? intersections[0] : false;
    
            }
    
        };
    
        THREE.TransformControls.prototype = Object.create(THREE.Object3D.prototype);
    
    }


    return SectionTool;
});