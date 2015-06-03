var languageBuilder = require('../util/language-builder');

module.exports = arithmeticLanguage();

function arithmeticLanguage() {
	var operator = '=== !== == != >>> << >> && || + - / * % , . | & ^ : ? ! ~'.split(' ');
	var identifier = /[A-Za-z\$_][A-Za-z\d\$_]*/;
	var decimal = /(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/;
	var hexadecimal = /0[xX][0-9a-fA-F]+/;
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
			parseMarkers: true,
			extra: {
				aether: 'whitespace'
			}
		});
}
