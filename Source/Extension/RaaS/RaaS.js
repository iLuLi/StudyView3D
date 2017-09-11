define([
    '../../Core/Manager/theExtensionManager',
    '../../Core/Manager/theHotkeyManager',
    '../Extension',
], function(theExtensionManager, theHotkeyManager, Extension) {
    'use strict';
    /**
    *
    * @param viewer
    * @param options
    * @constructor
    */
    var testScale;
   function RaaS(viewer, options) {

       Extension.call(this, viewer, options);
   }

   var proto = Object.create(Extension.prototype);
   proto.constructor = RaaS;

   var proto = RaaS.prototype;

   proto.load = function () {

       return true;
   };

   proto.unload = function () {

       return true;
   };

   proto.setShot = function (shoot) {

   };

   proto.getShot = function () {

   };

   proto.getCameraAsRenderDescriptor = function () {

       return cameraFromLMVToRaaS(this.viewer);
   };


   /**
    *
    * @param name
    */
   proto.setCameraFromViewName = function (name) {

       var docNode = this.viewer.model.getDocumentNode();
       docNode.search({ type: '3d', role: 'view' });

       this.viewer.setViewCube(name);
   };

   /**
    *
    * @param camera
    * @returns {*}
    */
   proto.setCameraFromRenderDescriptor = function (camera) {

       return cameraFromRaaSToLMV(this.viewer, camera);
   };

   /**
    *
    * @param viewer
    * @returns {{Projection: {Extent: *, IsOrthographic: *, NativeAspect: *}, Units: *, View: {Eye: *, At: Array, Up: *}}}
    */
   function cameraFromLMVToRaaS(viewer) {

       function getUnitsScale(units) {

           return testScale || viewer.model.getUnitScale() * 100;

           /*   // RaaS needs distances in centimeters.
                switch (units.toUpperCase()) {
                    case 'FOOT':
                        return 30.48;
                    case 'INCH':
                        return 2.54;
                    case 'KILOMETER':
                        return 100000.0;
                    case 'METER':
                        return 100.0;
                    case 'CENTIMETER':
                        return 1.0;
                    case 'MILLIMETER':
                        return 0.1;
                    default:
                        return 1.0;
                } */
       }

       function swapUpFromYtoZ(point) {

           var y = point[1];
           point[1] = -point[2];
           point[2] = y;

           return point;
       }

       function applyGlobalOffset(point, viewer) {

           var globalOffset = viewer.model.getData().globalOffset;

           if (globalOffset) {
               point[0] += globalOffset.x;
               point[1] += globalOffset.y;
               point[2] += globalOffset.z;
           }

           return point;
       }

       function getExtent(viewport) {

           if (viewport.isOrthographic) {
               return viewport.orthographicHeight * viewport.aspectRatio;
           } else {
               return viewport.fieldOfView * viewport.aspectRatio * Math.PI / 180;
           }
       }

       function applyUnitsScale(camera) {

           var scale = getUnitsScale(camera.Units);

           camera.View.Eye[0] *= scale;
           camera.View.Eye[1] *= scale;
           camera.View.Eye[2] *= scale;

           if (camera.Projection.IsOrthographic) {
               camera.Projection.Extent *= scale;
           }
       }

       var state = new Autodesk.Viewing.Private.ViewerState(viewer).getState();
       var viewport = state.viewport;

       var ey = viewport.eye;
       var at = viewport.target;
       var up = viewport.up;

       ey = applyGlobalOffset(ey, viewer);
       at = applyGlobalOffset(at, viewer);

       ey = swapUpFromYtoZ(ey);
       at = swapUpFromYtoZ(at);
       up = swapUpFromYtoZ(up);

       at = normalize([at[0] - ey[0], at[1] - ey[1], at[2] - ey[2]]);
       up = normalize(up);

       var extent = getExtent(viewport);
       var units = getUnits(viewer);

       //var focalDistance = focalDistance(viewer);
       var result = {
           Projection: {
               Extent: extent,
               IsOrthographic: viewport.isOrthographic,
               NativeAspect: viewport.aspectRatio
           },
           Units: units,
           View: {
               Eye: ey,
               At: at,
               Up: up
           }
           //      FocalDistance: focalDistance,
           //      Aperture: 0
       };

       applyUnitsScale(result);
       result.Units = 'CENTIMETER';
       return result;
   }

   /**
    *
    * @param viewer
    * @param camera
    */
   function cameraFromRaaSToLMV(viewer, camera) {

       function getUnitsScale(units, viewer) {

           // Units are in centimeters, convert to meters and apply current model scale.
           var viewerUnitScale = testScale || 1 / (viewer.model.getUnitScale() * 100);

           // Remove conversion to RaaS.
           var raasUnitScale = 1.0;
           switch (units.toUpperCase()) {
               case 'FOOT':
                   raasUnitScale = 1 / 30.48;
                   break;
               case 'INCH':
                   raasUnitScale = 1 / 2.54;
                   break;
               case 'KILOMETER':
                   raasUnitScale = 1 / 100000.0;
                   break;
               case 'METER':
                   raasUnitScale = 1.0 / 100.0;
                   break;
               case 'CENTIMETER':
                   raasUnitScale = 1.0;
                   break;
               case 'MILLIMETER':
                   raasUnitScale = 1 / 0.1;
                   break;
           }

           return viewerUnitScale;
       }

       function swapUpFromZtoY(point) {

           var y = point[1];
           point[1] = point[2];
           point[2] = -y;

           return point;
       }

       function applyUnitsScale(state, camera, viewer) {

           var scale = getUnitsScale(camera.Units, viewer);

           state.viewport.eye[0] *= scale;
           state.viewport.eye[1] *= scale;
           state.viewport.eye[2] *= scale;

           if (state.viewport.isOrthographic) {
               state.viewport.orthographicHeight *= scale;
           }
       }

       function applyGlobalOffset(point, viewer) {

           var globalOffset = viewer.model.getData().globalOffset;
           if (globalOffset) {
               point[0] -= globalOffset.x;
               point[1] -= globalOffset.y;
               point[2] -= globalOffset.z;
           }

           return point;
       }

       function setExtent(state, camera) {

           var projection = camera.Projection;
           var viewport = viewer.container.getBoundingClientRect();
           var aspectRatio = viewport.width / viewport.height;

           if (projection.isOrthographic) {
               state.viewport["orthographicHeight"] = projection.Extent / aspectRatio;
           } else {
               state.viewport["fieldOfView"] = projection.Extent / aspectRatio * 180 / Math.PI;
           }
       }

       var ey = swapUpFromZtoY(camera.View.Eye);
       var at = normalize(swapUpFromZtoY(camera.View.At));
       var up = normalize(swapUpFromZtoY(camera.View.Up));

       var ratio = camera.Projection.NativeAspect;
       var isOrthographic = camera.Projection.isOrthographic;
       var projection = isOrthographic ? 'orthographic' : 'perspective';

       var state = {
           viewport: {
               eye: ey,
               target: [ey[0] + at[0], ey[1] + at[1], ey[2] + at[2]],
               up: up,
               aspectRatio: ratio,
               projection: projection,
               isOrthographic: isOrthographic
           }
       };

       setExtent(state, camera);
       applyUnitsScale(state, camera, viewer);
       applyGlobalOffset(state.viewport.eye, viewer);
       state.viewport.target = [
           state.viewport.eye[0] + at[0] * 10,
           state.viewport.eye[1] + at[1] * 10,
           state.viewport.eye[2] + at[2] * 10
       ];

       new Autodesk.Viewing.Private.ViewerState(viewer).restoreState(state);
   }

   function getUnits(viewer) {

       var unitScale = viewer.model.getUnitScale();
       switch (unitScale) {
           case 1.0:
               return 'METER';
           case 0.3048:
               return 'FOOT';
           case 0.0254:
               return 'INCH';
           case 0.01:
               return 'CENTIMETER';
           case 0.001:
               return 'MILLIMETER';
           case 1000:
               return 'KILOMETER';
           default:
               return 'METER';
       }
   }

   function getModelScale(units) {

       switch (units.toUpperCase()) {
           case 'METER':
               return 1.0;
           case 'FOOT':
               return 0.3048;
           case 'INCH':
               return 0.0254;
           case 'CENTIMETER':
               return 0.01;
           case 'MILLIMETER':
               return 0.001;
           default:
               return 1.0;
       }
   }

   function normalize(point) {

       var x = point[0];
       var y = point[1];
       var z = point[2];

       var length = Math.sqrt(x * x + y * y + z * z);
       if (length === 0) {
           return point;
       }

       var invLength = 1 / length;
       return [x * invLength, y * invLength, z * invLength];
   }

   theExtensionManager.registerExtension('Autodesk.RaaS', RaaS);
});