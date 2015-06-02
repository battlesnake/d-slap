module.exports = evaluate;

function evaluate(expression) {
	/*
	 * Currently just generates functions in global scope.
	 *
	 * I think AngularJS $parse actually parses expressions and evaluates
	 * then via an interpreter.
	 */
	var get = new Function('scope', 'locals',
		'with (scope) { with (locals) { return (' + expression + '); } }');
	var set = new Function('scope', 'value',
		'with (scope) { ' + expression + ' = value; }');
	get.set = set;
	return get;
}
