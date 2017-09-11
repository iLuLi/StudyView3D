define(['../i18n'], function(i18n) {;
    'use strict'
    /**
    * Formats a value with units
    * @param {number} value
    * @param {string} units - GNU units format
    * @param {number} type - For example: 1=boolean, 2=integer, 3=double, 20=string, 24=Position
    * @param {number} precision - required precision.
    * see https://git.autodesk.com/A360/platform-translation-propertydb/blob/master/propertydb/PropertyDatabase.h
    * @returns {string} formatted value
    */
    var formatValueWithUnits = function (value, units, type, precision) {
   
       function modf(x) {
           var intPart = (0 <= x) ? Math.floor(x) : Math.ceil(x),
               fracPart = x - intPart;
           return { intPart: intPart, fracPart: fracPart };
       }
   
       function formatNumber(x, precision, needMinusSign) {
           var result = '';
   
           //        // Change -0.0 to 0.0
           //        if (x === 0.0) {
           //            x = 0.0;
           //        }
   
           if (needMinusSign && x === 0) {
               result += '-';
           }
   
           //According to Shawn's request, do not truncate trailing .0's
           //if (modf(x).fracPart === 0) {
           //
           //    // No fractional part.
           //    //
           //    result += x;
           //
           //} else if (0 < precision) {
           if (0 < precision) {
   
               // Truncate any trailing .0's.
               //
               //var s = x.toFixed(precision);
               //var re = /^\-?([0-9]+)\.0+$/;
               //var m = re.exec(s);
               //if (m !== null) {
               //    result += m[1];
               //} else {
               //    result += s;
               //}
   
               result += x.toFixed(precision);
   
           } else {
               result += x.toFixed(0);
           }
   
           return result;
       }
   
       function formatFeet(value, precision, inchesOnly) {
   
           // Borrowed from AdCoreUnits PrimeDoublePrimeSymbol2::Format
   
           var result = '',
               radix = 12.0,
               denominator = 1.0,
               isNegative = (value < 0);
   
           for (var i = 0; i < precision; ++i) {
               denominator *= 2.0;
           }
   
           // round to the nearest 1/denominator
           if (value > 0) {
               value += 0.5 / denominator;
           } else {
               value -= 0.5 / denominator;
           }
   
           var primeValue, doublePrimeValue;
   
           if (!inchesOnly) {
               primeValue = modf(value / radix).intPart;
               result += formatNumber(primeValue, 0, isNegative) + '\' ';
               doublePrimeValue = value - (primeValue * radix);
               if (doublePrimeValue < 0) {
                   doublePrimeValue = -doublePrimeValue;
               }
   
           } else {
               doublePrimeValue = value;
           }
   
           var intPart = modf(doublePrimeValue).intPart;
           var numerator = modf((doublePrimeValue - intPart) * denominator).intPart;
   
           if (numerator === 0 || intPart !== 0) {
               result += formatNumber(intPart, 0);
           }
   
           if (numerator !== 0) {
               if (intPart < 0 && numerator < 0) {
                   numerator = -numerator;
               }
               while (numerator % 2 === 0) {
                   numerator /= 2;
                   denominator /= 2;
               }
               if (intPart !== 0) {
                   result += '-';
               }
               result += formatNumber(numerator, 0) + '/' + formatNumber(denominator, 0);
           }
   
           result += '\"';
           return result;
       }
   
       function formatMeterAndCentimeter(value, precision) {
           var sign = '';
           if (value < 0) {
               sign = '-';
               value = Math.abs(value);
           }
           var modfValue = modf(value),
               mValue = modfValue.intPart,
               cmValue = modfValue.fracPart * 100.0;
   
           return sign + formatNumber(mValue, 0) + ' m ' + formatNumber(cmValue, precision) + ' cm';
       }
   
       function formatFeetAndDecimalInches(value, precision) {
           var sign = '';
           if (value < 0) {
               sign = '-';
               value = Math.abs(value);
           }
           var modfValue = modf(value),
               ftValue = modfValue.intPart,
               inValue = modfValue.fracPart * 12.0;
   
           return sign + formatNumber(ftValue, 0) + '\' ' + formatNumber(inValue, precision) + '\"';
       }
   
       var result;
   
       if (precision === undefined) {
           precision = 3;
       }
   
       if (type === 1) { // Boolean
           result = i18n.translate(value ? 'Yes' : 'No');
   
       } else if (type === 24) { // Position
   
           var position = value.split(' ');
           result = [];
   
           for (var i = 0; i < position.length; ++i) {
               result.push(formatValueWithUnits(parseFloat(position[i]), units, 3, precision));
           }
   
           result = result.join(', ');
       }
       else if ((type === 2 || type === 3) && isNaN(value)) {
           result = 'NaN';
   
       } else if (units === 'ft-and-fractional-in') {
           result = formatFeet(value * 12.0, precision);
   
       } else if (units === 'ft-and-fractional-in^2') {
           result = formatFeet(value * 12.0, precision) + ' ' + String.fromCharCode(0xb2);
   
       } else if (units === 'ft-and-decimal-in') {
           result = formatFeetAndDecimalInches(value, precision);
   
       } else if (units === 'ft-and-decimal-in^2') {
           result = formatFeetAndDecimalInches(value, precision) + ' ' + String.fromCharCode(0xb2);
   
       } else if (units === 'decimal-in' || units === 'in' || units === 'inch') {
           result = formatNumber(value, precision) + '\"';
   
       } else if (units === 'decimal-in^2' || units === 'in^2' || units === 'inch^2') {
           result = formatNumber(value, precision) + '\"' + ' ' + String.fromCharCode(0xb2);
   
       } else if (units === 'decimal-ft' || units === 'ft' || units === 'feet' || units === 'foot') {
           result = formatNumber(value, precision) + '\'';
   
       } else if (units === 'decimal-ft^2' || units === 'ft^2' || units === 'feet^2' || units === 'foot^2') {
           result = formatNumber(value, precision) + '\'' + ' ' + String.fromCharCode(0xb2);
   
       } else if (units === 'fractional-in') {
           result = formatFeet(value, precision, /*inchesOnly=*/true);
   
       } else if (units === 'fractional-in^2') {
           result = formatFeet(value, precision, /*inchesOnly=*/true) + ' ' + String.fromCharCode(0xb2);
   
       } else if (units === 'm-and-cm') {
           result = formatMeterAndCentimeter(value, precision);
   
       } else if (units === 'm-and-cm^2') {
           result = formatMeterAndCentimeter(value, precision) + ' ' + String.fromCharCode(0xb2);
   
       } else if (type === 3 && units) { // Double, with units
           units = units.replace("^2", String.fromCharCode(0xb2));
           units = units.replace("^3", String.fromCharCode(0xb3));
           result = formatNumber(value, precision) + ' ' + units;
   
       } else if (units) {
           result = value + ' ' + units;
   
       } else if (type === 3) { // Double, no units
           result = formatNumber(value, precision);
   
       } else {
           result = value;
       }
   
       return result;
   };

   return formatValueWithUnits;
});