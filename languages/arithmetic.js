var languageBuilder = require('../util/language-builder');

module.exports = arithmeticLanguage();

/**
 * @name arithmeticLanguage
 *
 * @description
 * A JavaScript-like language for arithmetic expressions.  Supports members,
 * subscripts, and functions.
 *
 * It is passed to the {@link recursiveParser} to generate the language parser.
 *
 * The result is a parse tree, which may be converted to an expression tree
 * by mapping or by transforming the parsed tokens to some form of subexpression
 * representation, as is done by the {@arithmeticEvaluator}.
 *
 * @example
 * See "arithmetic" unit tests.
 */
function arithmeticLanguage() {
	/* No operators with side effects */
	var operator = '=== !== == != >>> << >> && || + - / * % , . | & ^ : ? ! ~'.split(' ');
	/* Boo hoo no unicode cry me a river */
	var identifier = /[A-Za-z\$_][A-Za-z\d\$_]*/;
	var decimal = /(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/;
	var hexadecimal = /0[xX][0-9a-fA-F]+/;
	/* Boo hoo no octal or binary cry me a river */
	return languageBuilder(
		{
			$root: 'expression',
			whitespace: { entity: /\s+/, samePostgroups: true },
			expression: ['value', 'operator'],
			value: ['parentheses', 'identifier', 'number', 'string'],
			number: ['hexadecimal', 'decimal'],
			string: ['sqString', 'dqString'],
			postValue: ['operator', 'call', 'index'],
			parentheses: { start: '(', end: ')', subgroups: ['expression'], postgroups: ['postValue'] },
			call: { start: '(', end: ')', subgroups: ['expression'], postgroups: ['postValue'] },
			index: { start: '[', end: ']', subgroups: ['expression'], postgroups: ['postValue'] },
			array: { start: '[', end: ']', subgroups: ['expression'], postgroups: ['postValue'] },
			operator: { entity: operator, postgroups: ['expression'] },
			identifier: { entity: identifier, postgroups: ['postValue'] },
			decimal: { entity: decimal, postgroups: ['postValue'] },
			hexadecimal: { entity: hexadecimal, postgroups: ['postValue'] },
			sqString: { start: "'", end: "'", subgroups: ['sqVerbatim'], postgroups: ['postValue'] },
			dqString: { start: '"', end: '"', subgroups: ['dqVerbatim'], postgroups: ['postValue'] },
			sqVerbatim: { entity: /(\\'|[^'])*/, postgroups: [] },
			dqVerbatim: { entity: /(\\"|[^"])*/, postgroups: [] },
		}, {
			/*
			 * Group start/end markers and entities should not be stripped from
			 * the value strings in the parse tree
			 */
			parseMarkers: true,
			extra: {
				/*
				 * Allow whitespace between any tokens, even if not explicitly
				 * listed as allowed (in subgroups/postgroups).
				 */
				aether: 'whitespace'
			}
		});
}
