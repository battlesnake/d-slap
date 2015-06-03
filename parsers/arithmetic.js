var _ = require('lodash');
var recursiveParser = require('./recursive');
var arithmeticLanguage = require('../languages/arithmetic');

/**
 * @name arithmeticEvaluator
 *
 * @param {string} expression
 * The arithmetic expression to parse
 *
 * @param {object} [options]
 * Options for the parser / compiler / evaluator.
 *
 *  * rawScope: Allows direct access to the scope (writable globals).
 *    Normally, the scope is merged into a new temporary scope which contains
 *    some built-in variables (true, false, undefined, null).  If rawScope is
 *    enabled, then these built-ins are not available (unless declared
 *    explicitly in the scope), but direct properties of the scope object can be
 *    modified.
 *
 *  * notStrict: prevents throwing of exceptions on attempts to access globals
 *    (i.e. direct properties of the scope) which do not exist.
 *
 * @return {function}
 * This function takes a arithmetic expression and returns an evaluator
 * function.  Where possible, a setter function is also provided to allow
 * modification of the expression's target.
 *
 * To evaluate: result(scope) or result.evaluate(scope)
 * To set: result.set(scope, value)
 *
 * @description
 * A function which generates a arithmetic evaluator for any given
 * arithmetic expression.  The generated arithmetic evaluator evaluates the
 * expression in a given context.  A setter is also provided where possible.
 *
 * The function parses the arithmetic expression using the
 * {@link recursiveParser}, given the {@link arithmeticLanguage} definition.
 */

module.exports = arithmeticEvaluatorFactory;

/**
 * @name arithmeticEvaluatorFactory
 * @private
 *
 * @description
 * See {@link arithmeticLanguage}
 */
function arithmeticEvaluatorFactory(expression, options) {
	options = _.assign({ rawScope: false, notStrict: false }, options);
	var tree = recursiveParser(expression, arithmeticLanguage, {
		originalStrings: true,
	});
	var evaluator = compileTree(tree, { strictMode: !options.notStrict });
	evaluate.evaluate = evaluate;
	evaluate.set = set;

	var constants = {
		'null': null,
		'undefined': undefined,
		'true': true,
		'false': false,
		'NaN': NaN,
		'Infinity': Infinity
	};

	return options.rawScope ? evaluator : evaluate;

	function evaluate(scope, locals) {
		scope = _.assign({}, constants, scope, locals);
		return evaluator.evaluate(scope);
	}

	function set(scope, locals, value) {
		if (arguments.length === 2) {
			value = locals;
			locals = undefined;
		}
		scope = _.assign({}, constants, scope, locals);
		evaluator.set(scope, value);
	}
}

function compileTree(tree, options) {

	options = _.assign({ strictMode: true }, options);
	var strictMode = options.strictMode;

	/* Greenspun's tenth rule in action */

	/* Reducer uses this to determine which elements to remove */
	var directions = {
		prevCurr: 1,
		curr: 2,
		currNext: 3,
		prevCurrNext: 4
	};

	/* Operator precedence */
	var precedence = [
		{ level: 19, direction: 1, items: [mapSubexpressions, mapSymbols, mapValues] },
		{ level: 18, direction: 1, items: [mapMembers, mapIndexes, mapCalls] },
	//	{ level: 17, direction: 1, items: [mapCalls] },
	//	{ level: 16, direction: 1, items: [mapPostfix] },
		{ level: 15, direction: 0, items: [mapLogicalNot, mapBitwiseNot, mapValueSign/*, mapPrefix*/] },
		{ level: 14, direction: 1, items: [mapMultiplicative] },
		{ level: 13, direction: 1, items: [mapAdditive] },
		{ level: 12, direction: 1, items: [mapShifts] },
		{ level: 11, direction: 1, items: [mapRelational] },
		{ level: 10, direction: 1, items: [mapEquality] },
		{ level: 9, direction: 1, items: [mapBitwiseAnd] },
		{ level: 8, direction: 1, items: [mapBitwiseXor] },
		{ level: 7, direction: 1, items: [mapBitwiseOr] },
		{ level: 6, direction: 1, items: [mapLogicalAnd] },
		{ level: 5, direction: 1, items: [mapLogicalOr] },
		{ level: 4, direction: 0, items: [mapTernaryOperation] },
	//	{ level: 3, direction: 0, items: [mapAssignment] },
		{ level: 0, direction: 1, items: [mapSequence] },
	];

	Evaluatable.prototype = {
		node: null,
		type: null,
		set: function (scope, value) {
			throw new Error('Expression is read-only');
		},
		evaluate: function (scope) {
			throw new Error('Expression cannot be evaluated');
		},
		evaluateList: function (scope) {
			return [this.evaluate(scope)];
		}
	};

	Symbol.prototype = new Evaluatable();
	Expression.prototype = new Evaluatable();
	Value.prototype = new Evaluatable();
	PrefixUnaryOperation.prototype = new Evaluatable();
	PostfixUnaryOperation.prototype = new Evaluatable();
	BinaryOperation.prototype = new Evaluatable();
	TernaryOperation.prototype = new Evaluatable();
	Member.prototype = new Evaluatable();
	Index.prototype = new Evaluatable();
	Call.prototype = new Evaluatable();

	return new Expression(tree);

	/*** Parse tree => Expression tree translators ***/

	function mapSubexpressions(curr, prev, next) {
		if (curr.type !== 'parentheses') {
			return;
		}
		return {
			direction: directions.curr,
			result: new Expression(curr)
		};
	}

	function mapSymbols(curr, prev, next) {
		if (curr.type !== 'identifier') {
			return;
		}
		return {
			direction: directions.curr,
			result: new Symbol(curr)
		};
	}

	function mapValues(curr, prev, next) {
		if (curr.type === 'decimal') {
			return {
				direction: directions.curr,
				result: new Value(curr, parseFloat(curr.content))
			};
		} else if (curr.type === 'hexadecimal') {
			return {
				direction: directions.curr,
				result: new Value(curr, parseInt(curr.content))
			};
		} else if (curr.type === 'sqString' || curr.type === 'dqString') {
			return {
				direction: directions.curr,
				result: new Value(curr, unescapeJsStr(curr.groups[0].content))
			};
		}
	}

	function mapMembers(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || !(prev instanceof Evaluatable) || curr.content !== '.' || next.type !== 'identifier') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new Member(curr, prev, next)
		};
	}

	function mapIndexes(curr, prev, next) {
		if (curr.type !== 'index' || !(prev instanceof Evaluatable)) {
			return;
		}
		return {
			direction: directions.prevCurr,
			result: new Index(curr, prev, curr)
		};
	}

	function mapCalls(curr, prev, next) {
		if (curr.type !== 'call' || !(prev instanceof Evaluatable)) {
			return;
		}
		return {
			direction: directions.prevCurr,
			result: new Call(curr, prev, curr)
		};
	}

	function mapPostfix(curr, prev, next) {
		if (!prev || curr.type !== 'operator' || curr.content !== '--' && curr.content !== '++') {
			return;
		}
		return {
			direction: directions.currNext,
			result: new PostfixUnaryOperation(curr, prev)
		};
	}

	function mapLogicalNot(curr, prev, next) {
		if (!next || curr.type !== 'operator' || curr.content !== '!') {
			return;
		}
		return {
			direction: directions.currNext,
			result: new PrefixUnaryOperation(curr, next)
		};
	}

	function mapBitwiseNot(curr, prev, next) {
		if (!next || curr.type !== 'operator' || curr.content !== '~') {
			return;
		}
		return {
			direction: directions.currNext,
			result: new PrefixUnaryOperation(curr, next)
		};
	}

	function mapValueSign(curr, prev, next) {
		if (prev && prev.type !== 'operator' || !next || curr.type !== 'operator' || curr.content !== '+' && curr.content !== '-') {
			return;
		}
		return {
			direction: directions.currNext,
			result: new PrefixUnaryOperation(curr, next)
		};
	}

	function mapPrefix(curr, prev, next) {
		if (!next || curr.type !== 'operator' || curr.content !== '--' && curr.content !== '++') {
			return;
		}
		return {
			direction: directions.currNext,
			result: new PrefixUnaryOperation(curr, next)
		};
	}

	function mapMultiplicative(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '/' && curr.content !== '*' && curr.content !== '%') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapAdditive(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '+' && curr.content !== '-') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapShifts(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '<<' && curr.content !== '>>' && curr.content !== '>>>') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapRelational(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '<' && curr.content !== '<=' && curr.content !== '>' && curr.content !== '>=') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapEquality(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '==' && curr.content !== '!=' && curr.content !== '===' && curr.content !== '!==') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapBitwiseAnd(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '&') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapBitwiseOr(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '|') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapBitwiseXor(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '^') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapLogicalAnd(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '&&') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapLogicalOr(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== '||') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	function mapTernaryOperation(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== ':' && curr.content !== '?') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new TernaryOperation(curr, prev, next)
		};
	}

	function mapSequence(curr, prev, next) {
		if (!prev || !next || curr.type !== 'operator' || curr.content !== ',') {
			return;
		}
		return {
			direction: directions.prevCurrNext,
			result: new BinaryOperation(curr, prev, next)
		};
	}

	/*** Evaluatable classes ***/

	/* Base abstract class for something that can be evaluated */
	function Evaluatable(node) {
		if (!arguments.length) {
			return;
		}
		this.node = node;
		this.type = node.type;
	}

	/* Class for something that is or that produces a raw value */
	function Expression(node, subclass) {
		Evaluatable.call(this, node);
		if (subclass) {
			return;
		}
		if (node instanceof Evaluatable) {
			return node;
		}
		var nodes = [].slice.apply(node.groups);
		_(precedence)
			.sortByOrder(['level', 'direction'], [false, false])
			.each(function (oplist) {
				var iterator = oplist.direction === 1 ? reductionIteratorLeftToRight : reductionIteratorRightToLeft;
				iterator(nodes, oplist.items);
			})
			.value();
		if (nodes.length !== 1 || !(nodes[0] instanceof Evaluatable)) {
			throw new Error('Failed to parse expression');
		}
		var root = nodes[0];
		this.evaluate = evaluate;
		this.set = set;

		function evaluate(scope) {
			return root.evaluate(scope);
		}

		function set(scope, value) {
			return root.set(scope, value);
		}
	}

	/* Class for a variable name */
	function Symbol(node) {
		Evaluatable.call(this, node);
		var name = node.content;
		this.evaluate = evaluate;
		this.set = set;
		this.name = name;

		function evaluate(scope) {
			if (strictMode && !(name in scope)) {
				throw new Error('Undefined variable: ' + name);
			}
			return scope[name];
		}

		function set(scope, value) {
			if (strictMode && !(name in scope)) {
				throw new Error('Undefined variable: ' + name);
			}
			scope[name] = value;
		}
	}

	function Value(node, value) {
		Expression.call(this, node, true);
		this.evaluate = function (scope) { return value; };
	}

	function Member(node, left, right) {
		Evaluatable.call(this, node);
		var base = left;
		var prop = right.name;
		this.evaluate = evaluate;
		this.set = set;
		this.base = base;
		this.prop = prop;

		function evaluate(scope) {
			return base.evaluate(scope)[prop];
		}

		function set(scope, value) {
			base.evaluate(scope)[prop] = value;
		}
	}

	function Index(node, left, inner) {
		Evaluatable.call(this, node);
		var base = left;
		var index = new Expression(inner);
		this.evaluate = evaluate;
		this.set = set;
		this.base = base;
		this.index = index;

		function evaluate(scope) {
			return base.evaluate(scope)[index.evaluate(scope)];
		}

		function set(scope, value) {
			base.evaluate(scope)[index.evaluate(scope)] = value;
		}
	}

	function Call(node, left, inner) {
		Evaluatable.call(this, node);
		var func = left;
		var params = new Expression(inner);
		this.evaluate = evaluate;
		this.func = func;
		this.params = params;

		function evaluate(scope) {
			var fn = func.evaluate(scope);
			var ar = params.evaluateList(scope);
			var obj = (func instanceof Member) ? func.base.evaluate(scope) : undefined;
			return fn.apply(obj, ar);
		}
	}

	function TernaryOperation(node, left, right) {
		Evaluatable.call(this, node);
		var condition;
		var trueValue;
		var falseValue;
		if (right instanceof TernaryOperation && node.content === '?' && right.isColonPart) {
			condition = new Expression(left);
			trueValue = right.trueValue;
			falseValue = right.falseValue;
			this.evaluate = evaluate;
		} else if (node.content === ':') {
			trueValue = new Expression(left);
			falseValue = new Expression(right);
			this.evaluate = function (scope) { throw new Error('Incomplete ternary (missing "?")'); };
		} else {
			throw new Error('Incomplete ternary (missing ":")');
		}

		this.isColonPart = node.content === ':';
		this.condition = condition;
		this.trueValue = trueValue;
		this.falseValue = falseValue;

		function evaluate(scope) {
			return (condition.evaluate(scope) ? trueValue : falseValue).evaluate(scope);
		}
	}

	function PrefixUnaryOperation(node, inner) {
		Expression.call(this, node, true);
		var operators = {
			'-': function (value) { return -value; },
			'+': function (value) { return +value; },
			'!': function (value) { return !value; },
			'~': function (value) { return ~value; },
			'++': function (value) { return ++value; },
			'--': function (value) { return --value; }
		};
		var operator = operators[node.content];
		var operand = new Expression(inner);
		if (!operator) {
			throw new Error('Could not resolve operator "' + node.content + '"');
		}
		this.evaluate = evaluate;

		function evaluate(scope) {
			return operator(operand.evaluate(scope));
		}
	}

	function PostfixUnaryOperation(node, inner) {
		Expression.call(this, node, true);
		var operators = {
			'++': function (value) { return value++; },
			'--': function (value) { return value--; }
		};
		var operator = operators[node.content];
		var operand = new Expression(inner);
		if (!operator) {
			throw new Error('Could not resolve operator "' + node.content + '"');
		}
		this.evaluate = evaluate;

		function evaluate(scope) {
			return operator(operand.evaluate(scope));
		}
	}

	function BinaryOperation(node, left, right) {
		Expression.call(this, node, true);
		var leftOperand = new Expression(left);
		var rightOperand = new Expression(right);
		var operators = {
			'*': function (a, b) { return a * b; },
			'/': function (a, b) { return a / b; },
			'%': function (a, b) { return a % b; },
			'+': function (a, b) { return a + b; },
			'-': function (a, b) { return a - b; },
			'<<': function (a, b) { return a << b; },
			'>>': function (a, b) { return a << b; },
			'>>>': function (a, b) { return a >>> b; },
			'<': function (a, b) { return a < b; },
			'<=': function (a, b) { return a <= b; },
			'>': function (a, b) { return a > b; },
			'>=': function (a, b) { return a >= b; },
			/* jshint ignore:start */
			'==': function (a, b) { return a == b; },
			'!=': function (a, b) { return a != b; },
			/* jshint ignore:end */
			'===': function (a, b) { return a === b; },
			'!==': function (a, b) { return a !== b; },
			'&': function (a, b) { return a & b; },
			'^': function (a, b) { return a ^ b; },
			'|': function (a, b) { return a | b; },
			'&&': function (a, b) { return a && b; },
			'||': function (a, b) { return a || b; },
			',': function (a, b) { return a , b; },
		};
		var operator = operators[node.content];
		if (!operator) {
			throw new Error('Could not resolve operator "' + operator + '"');
		}
		this.evaluate = evaluate;
		this.evaluateList = evaluateList;

		function evaluate(scope) {
			return operator(leftOperand.evaluate(scope), rightOperand.evaluate(scope));
		}

		function evaluateList(scope) {
			if (operator === ',') {
				return leftOperand.evaluateList(scope).concat(
					rightOperand.evaluateList(scope));
			} else {
				return [evaluate(scope)];
			}
		}
	}

	/*** Reduction iterators ***/

	/* Pass over node list from left to right, splicing as needed */
	function reductionIteratorLeftToRight(nodes, walkers) {
		var res = [];
		var i = 0;
		while (i < nodes.length) {
			var prev = i > 0 ? nodes[i - 1] : null;
			var curr = nodes[i];
			var next = i < nodes.length - 1 ? nodes[i + 1] : null;
			var merge = _(walkers)
				/* jshint ignore:start */
				.map(function (walker) { return walker(curr, prev, next); })
				/* jshint ignore:end */
				.filter()
				.first();
			if (!merge) {
				i++;
			} else if (merge.direction === directions.prevCurr) {
				nodes.splice(i - 1, 2, merge.result);
			} else if (merge.direction === directions.currNext) {
				nodes.splice(i, 2, merge.result);
			} else if (merge.direction === directions.curr) {
				nodes.splice(i, 1, merge.result);
				i++;
			} else if (merge.direction === directions.prevCurrNext) {
				nodes.splice(i - 1, 3, merge.result);
			}
		}
	}

	/*
	 * Pass over node list from right to left, splicing as needed.
	 *
	 * prev/next refers to list order, not iteration order.
	 */
	function reductionIteratorRightToLeft(nodes, walkers) {
		var res = [];
		var i = nodes.length - 1;
		while (i >= 0) {
			var prev = i > 0 ? nodes[i - 1] : null;
			var curr = nodes[i];
			var next = i < nodes.length - 1 ? nodes[i + 1] : null;
			var merge = _(walkers)
				/* jshint ignore:start */
				.map(function (walker) { return walker(curr, prev, next); })
				/* jshint ignore:end */
				.filter()
				.first();
			if (!merge) {
				i--;
			} else if (merge.direction === directions.prevCurr) {
				nodes.splice(i - 1, 2, merge.result);
				i-=2;
			} else if (merge.direction === directions.currNext) {
				nodes.splice(i, 2, merge.result);
			} else if (merge.direction === directions.curr) {
				nodes.splice(i, 1, merge.result);
				i++;
			} else if (merge.direction === directions.prevCurrNext) {
				nodes.splice(i - 1, 3, merge.result);
				i-=2;
			}
		}
	}

	function unescapeJsStr(str) {
		var codes = {
			'"': '"',
			"'": "'",
			'\\': '\\',
			'n': '\n',
			't': '\t',
			'r': '\r',
			'b': '\b',
			'f': '\f'
		};
		return str.replace(/\\./g, function (match) {
			var char = match.substr(1);
			if (char in codes) {
				return codes[char];
			} else {
				return char;
			}
		});
	}

}
