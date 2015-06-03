var _ = require('lodash');
var listLanguage = require('../languages/list');
var comprehensionParser = require('./comprehension');
var arithmetic = require('./arithmetic');

module.exports = listParser();

/**
 * @name listParser
 *
 * @param {string} expr
 * A list comprehension expression
 *
 * @param {scope} scope
 * The scope to evaluate the expression in
 *
 * @param {function} onchange
 * function (items, grouped) called when the data changes
 *
 * @returns {object}
 *
 *   * refresh: function, call to refresh the items array.  Returns a
 *     promise which is resolved when the items array has been
 *     refreshed, and oninvalidate has been called.
 *
 *   * requery: if the last refresh/requery received a function<promise> from
 *     the underlying data source, call refresh to re-execute that function
 *     (presumably returning a new promise).  Otherwise, just return the
 *     previous result.
 *
 * @description
 * This service takes a {@link listLanguage|List Comprehension Expression}
 * as a parameter and returns a methods for interrogating the data source.
 * Data is automatically mapped as specified by the list comprehension
 * expression.  The data source can be a promise.
 *
 * @example
 *
 *     <my:directive my:source="item.title for item in model.items"/>
 *
 *     var binding = listParser(attrs.mySource, scope, updateItems);
 *     binding.refresh();
 *
 *     function updateItems(items) {
 *         ...
 *     }
 */
function listParser() {
	var compParser = comprehensionParser(listLanguage);

	/* Expose extra functions */
	listParserFactory.test = {
		compile: function () {
			/* Compile from scratch each time for benchmarking */
			return comprehensionParser(listLanguage);
		},
		parse: function (expr) {
			return compParser(expr);
		},
		fillDefaults: testFillDefaults
	};

	/* See {@link listParser|list comprehension service} */
	return listParserFactory;

	function listParserFactory(expr) {
		var comp = compParser(expr);

		if (!comp) {
			throw new Error('Comprehension is invalid: ' + expr);
		}

		fillDefaults(comp);

		/* Function(scope) which gets the data source */
		var sourceGetter = arithmetic(comp.source);

		/*
		 * Parse mapping expressions and store accessors as
		 * Function(scope, locals, key, value)
		 */
		var params = {
			group: getField(comp.group),
			label: getField(comp.label),
			select: getField(comp.select),
			memo: getField(comp.memo),
		};

		return getItems;

		/**
		 * @function getItems
		 * @private
		 *
		 * @param {scope} scope
		 * The scope to evaluate the expression in
		 *
		 * @returns {promise}
		 * Array of items from the data source, mapped as specified by the
		 * comprehension expression.
		 */
		function getItems(scope, locals) {
			var data = sourceGetter(scope, locals);
			var index = 0;

			return _.map(data, extractor);

			function extractor(value, key) {
				return {
					index: index++,
					select: params.select(scope, locals, key, value),
					label: params.label(scope, locals, key, value),
					memo: params.memo(scope, locals, key, value),
					group: params.group(scope, locals, key, value),
					key: key,
					value: value
				};
			}
		}

		/**
		 * @function getField
		 * @private
		 *
		 * @param {string} expr
		 * The expression to evaluate
		 *
		 * @returns {function}
		 * A function(scope, locals, key, value) which evaluates the given
		 * expression.
		 */
		function getField(expr) {
			var parsed = arithmetic(expr);
			/**
			 * @function get
			 * @private
			 *
			 * @param {scope} scope
			 * The scope to evaluate the expression in
			 *
			 * @param {string} key
			 * The key or array-index of the current item
			 *
			 * @param {any} value
			 * The value of the current item
			 *
			 * @returns {any}
			 * Result of expression evaluation
			 *
			 * @description
			 * Evaluates the expression with the given context
			 */
			return function get(scope, vars, key, value) {
				var locals = _.assign({}, vars);
				locals[comp.value] = value;
				if (comp.key !== undefined) {
					locals[comp.key] = key;
				}
				return parsed(scope, locals);
			};
		}

	}

	/**
	 * @function fillDefaults
	 * @private
	 *
	 * @param {object} comp
	 * The parsed comprehension expression
	 *
	 * @description
	 * Fill defaults in parsed comprehension
	 */
	function fillDefaults(comp) {
		/* No {source} (should result in comp===undefined but check anyway) */
		if (!comp.source) {
			throw new Error('Source not specified invalid');
		}
		/* Only "{source}" */
		if (comp.value === undefined) {
			comp.value = 'item';
			comp.label = 'item.title';
			comp.select = 'item.value';
		}
		/* No "{select} as" */
		if (comp.select === undefined) {
			comp.select = comp.label;
		}
		/* No "track by {memo}" */
		if (comp.memo === undefined) {
			comp.memo = comp.select;
		}
	}

	/**
	 * @function testFillDefaults
	 * @private
	 * @param {string} expr
	 * The expression to fill and return
	 *
	 * @returns {string}
	 * Expression with defaults filled in
	 *
	 * @description
	 * Parses an expression, fills in defaults, rebuilds expression to a
	 * string and returns it.
	 *
	 * If:
	 *   filled = testFillDefaults(expr)
	 * Then:
	 *   filled === testFillDefaults(filled)
	 */
	function testFillDefaults(expr) {
		var comp = compParser(expr);
		fillDefaults(comp);
		return _.flatten([
			comp.select,
			'as',
			comp.label,
			comp.group !== undefined ? ['group by', comp.group] : [],
			'for',
			comp.key !== undefined ?
				'(' + comp.key + ', ' + comp.value + ')' :
				comp.value,
			'in',
			comp.source,
			'track by',
			comp.memo
		]).join(' ');
	}

}
