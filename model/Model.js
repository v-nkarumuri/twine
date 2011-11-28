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

define([
	'../support/array',
	'../support/compose',
	'../support/Evented',
	'../support/promise',
	'../support/lang',
	'../util/error'
], function (arr, compose, Evented, promise, lang, error) {
	'use strict';

	function Model(config) {
		this.config = config;
		this._commissions = [];
		this._decommissions = [];

		this.deps = this.deps || {};
		this.mixin = this.mixin || {};

		// if no id was provided
		if (!this.id) {
			if (!this.service) {
				throw new error.MissingId(this);
			}
			// use the combination of service and name
			this.id = [this.service, this.name].join('/');
		}

		if (!this.module) {
			this.module = this.id;
		}
	}

	return compose(compose, Evented, Model, {
		// id must be unique per registry
		id: '',

		// name must be unique per service
		name: '',
		// the combination of service and name must be unique per registry
		service: '',

		// module is what will be used to generate instances and can be either a string or an
		// object or a function.
		//	- a string will be used as a module id for require to load.
		//	- an object will be used as an instance and construct always returns that object
		//	- a function will be used as a constructor.  construct returns new instances
		module: null,

		// mixed into an instance generated by this model before it's constructor is called
		mixin: null,

		// this is a map of dependencies to be resolved before creating an instance.
		// the objects resolved based on these deps are then mixed into an instance.
		// property name -> a model spec as used by registry.getModel(model.deps[key])
		deps: null,

		// provides a way to load this model.  needs to be provided by config or container.  A
		// component config can specify a load property OR the config item passed to
		// container.configure can provide a load property OR a container can be created with
		// a load property.
		// this decouples twine from a specific loading mechanism.
		load: null,

		// returns a promise to resolve a component
		resolve: function (args) {
			if (!this.lifecycle) {
				throw new error.MissingLifecycle(this);
			}

			var model = this;

			// resolving might be asynchronous
			return promise.whenPromise(this.lifecycle.resolve(args), function (component) {
				model.emit('componentResolved', component);
				return component;
			});
		},

		// releases the component
		release: function (instance) {
			if (!this.lifecycle) {
				throw new error.MissingLifecycle(this);
			}

			// releasing must be synchronous
			this.lifecycle.release(instance);
			this.emit('componentReleased', instance);
			return instance;
		},

		addMixin: function (obj) {
			compose.call(this.mixin, obj);
		},

		// returns a promise to build an instance based on this model
		construct: function (args) {
			var model = this;

			return this._getModule().then(function (module) {
				var specs = model.deps,
					registry,
					deps = {};

				// if the module is a function then we resolve it as a constructor
				if (typeof module === 'function') {
					registry = model.kernel.modelRegistry;
					// get the models for all the specified dependencies
					arr.forEach(lang.keys(specs), function (key) {
						deps[key] = registry.getModel(specs[key]).resolve();
					});

					// resolve all the dependencies and then construct an instance
					return promise.allKeys(deps).then(function (deps) {
						var Ctor = compose(module, deps, model.mixin),
							inst = new Ctor(args);
						model.emit('componentConstructed', inst);
						return inst;
					});
				}

				// if the module is anything other than a function, return it as the instance
				compose.call(module, model.mixin, args); // allow a mixin and args but no deps
				model.emit('componentConstructed', module);
				return module;
			});
		},

		_getModule: function () {
			var dfd = promise.defer(),
				model = this;

			// if module is a string, it needs to be loaded
			if (typeof model.module === 'string') {
				model.load([model.module], function (module) {
					// short circuit any future calls
					model.module = module;
					dfd.resolve(module);
				});
			}
			else {
				dfd.resolve(model.module);
			}

			return dfd.promise;
		},

		deconstruct: function (instance) {
			this.emit('componentDeconstructed', instance);
			return instance;
		},

		addCommissioner: function (it) {
			// a commissioner can provide 'commission' and/or 'decomission' help
			function commissioner(instance) {
				return it.commission.call(it, instance, model);
			}

			function decommissioner(instance) {
				return it.decommission.call(it, instance, model);
			}

			var model = this,
				commissions = model._commissions,
				decommissions = model._decommissions;

			if (typeof it.commission === 'function') {
				commissions.push(commissioner);
			}

			if (typeof it.decommission === 'function') {
				decommissions.push(decommissioner);
			}

			return {
				remove: function () {
					var index = arr.indexOf(commissions, commissioner);

					if (~index) {
						commissions.splice(commissioner, 1);
					}

					index = arr.indexOf(decommissions, decommissioner);

					if (~index) {
						decommissions.splice(decommissioner, 1);
					}
				}
			};
		},

		commission: function (inst) {
			// commission may be asynchronous
			var model = this;
			return promise.seq(model._commissions, inst).then(function (instance) {
				model.emit('componentCommissioned', instance);
				return instance;
			});
		},

		decommission: function (inst) {
			// decommission is synchronous
			var model = this;
			arr.forEach(model._decommissions.slice(), function (decommission) {
				decommission(inst, model);
			});
			model.emit('componentDecommissioned', inst);
			return inst;
		},

		destroy: function () {
			this.emit('destroyed', this);
		}
	});
});
