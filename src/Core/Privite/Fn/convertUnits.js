define(function() {;
    'use strict'
    /**
    * Convert distance from unit to unit.
    * @param {string} fromUnits - GNU units format - units to convert from
    * @param {string} toUnits - GNU units format - units to convert to
    * @param {number} d - distance to convert
    * @param {string} type - default for distance, "square" for area
    * @returns {number} - distance after conversion.
    */
    return function (fromUnits, toUnits, d, type) {
   
       if (fromUnits === toUnits)
           return d;
   
       var toFactor = 1;
       switch (toUnits) {
           case "mm": toFactor = 1000; break;
           case "cm": toFactor = 100; break;
           case "m": toFactor = 1; break;
           case "in": toFactor = 39.37007874; break;
           case "ft": toFactor = 3.280839895; break;
           case "ft-and-fractional-in": toFactor = 3.280839895; break;
           case "ft-and-decimal-in": toFactor = 3.280839895; break;
           case "decimal-in": toFactor = 39.37007874; break;
           case "decimal-ft": toFactor = 3.280839895; break;
           case "fractional-in": toFactor = 39.37007874; break;
           case "m-and-cm": toFactor = 1; break;
       }
   
       var fromFactor = 1;
       switch (fromUnits) {
           case "mm": fromFactor = 0.001; break;
           case "cm": fromFactor = 0.01; break;
           case "m": fromFactor = 1; break;
           case "in": fromFactor = 0.0254; break;
           case "ft": fromFactor = 0.3048; break;
           case "ft-and-fractional-in": fromFactor = 0.3048; break;
           case "ft-and-decimal-in": fromFactor = 0.3048; break;
           case "decimal-in": fromFactor = 0.0254; break;
           case "decimal-ft": fromFactor = 0.3048; break;
           case "fractional-in": fromFactor = 0.0254; break;
           case "m-and-cm": fromFactor = 1; break;
       }
   
       if (type === "square") {
   
           return (d * Math.pow(toFactor * fromFactor, 2));
       }
       return (d * toFactor * fromFactor);
   };
});