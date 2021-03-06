/**
 * @license Copyright (c) 2011 Cello Software, LLC.
 * All rights reserved.
 * Available via the new BSD License.
 */
/*jshint
	asi: false, bitwise: false, boss: false, curly: true, eqeqeq: true, eqnull: false, es5: true,
	evil: false, expr: true, forin: true, globalstrict: false, immed: true, indent: 4, latedef: true,
	laxbreak: false, loopfunc: true, maxlen: 100, newcap: true, noarg: true, noempty: true,
	nonew: true, nomen: false, onevar: true, passfail: false, plusplus: false, shadow: false,
	strict: false, sub: false, trailing: true, undef: true, white: true
*/
/*global define: false, require: false*/

define(['dojo/_base/lang'], function (d) {
	'use strict';
	// cache the lookup of some Object.prototype functions
	var hasOwn = {}.hasOwnProperty;

	function keys(it) {
		var out = [],
			prop;

		for (prop in it) {
			if (hasOwn.call(it, prop)) {
				out.push(prop);
			}
		}
		return out;
	}

	return {
		isString: d.isString,
		isFunction: d.isFunction,
		keys: keys,
		hitch: d.hitch
	};
});