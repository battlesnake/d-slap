var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var listParser = require('../parsers/list');
var _ = require('lodash');

/**
 * @name list-parser
 */

/* Angular ng-options example expressions */
var ngOptions = [
	'label for value in array',
	'select as label for value in array',
	'label group by group for value in array',
	'select as label group by group for value in array',
	'select as label group by group for value in array track by trackexpr',

	'label for (key, value) in object',
	'select as label for (key, value) in object',
	'label group by group for (key, value) in object',
	'select as label group by group for (key, value) in object',
	'select as label group by group for (key, value) in object track by trackexpr'
];

describe('List comprehension parser', function () {

	describe('Parses a bare expression', function () {

		it('func(array[index].value)', function () {
			var expr = 'func(array[index].value)';
			var comp = listParser.test.parse(expr);
			expect(comp.source).to.equal(expr);
		});

	});

	describe('Parses AngularJS ngOptions example formats', function () {

		ngOptions.forEach(test);

		function test(format) {
			it(format, function () {
				var comp;
				expect(
					function () {
						comp = listParser.test.parse(format);
					})
					.to.not.throw();
				verify({
					select: 'select',
					label: 'label',
					group: 'group',
					key: 'key',
					value: 'value',
					source: format.indexOf('array') === -1 ? 'object' : 'array',
					memo: 'trackexpr'
				});
				/*
				 * If the key is contained in the format, ensure the capture
				 * matches the test value (defaults to key)
				 */
				function verify(map) {
					_.each(map, function (value, key) {
						if (format.indexOf(key) !== -1) {
							expect(comp[key]).to.equal(value || key);
						}
					});
				}
			});
		}

	});

	describe('Fills defaults correctly', function () {

		test('item.label for item in items',
			'item.label as item.label for item in items track by item.label');
		test('item.value as item.label for item in items',
			'item.value as item.label for item in items track by item.value');
		test('item.label group by item.group for item in items',
			'item.label as item.label group by item.group for item in items track by item.label');
		test('item.value as item.label group by item.group for item in items',
			'item.value as item.label group by item.group for item in items track by item.value');
		
		test('item.value as item.label group by item.group for item in items track by item.id',
			'item.value as item.label group by item.group for item in items track by item.id');
		test('key for (key, value) in object',
			'key as key for (key, value) in object track by key');
		test('value as key for (key, value) in object track by value',
			'value as key for (key, value) in object track by value');
		test('key group by value.group for (key, value) in object',
			'key as key group by value.group for (key, value) in object track by key');
		test('value as key group by value.group for (key, value) in object',
			'value as key group by value.group for (key, value) in object track by value');
		test('value as key group by value.group for (key, value) in object track by value.id',
			'value as key group by value.group for (key, value) in object track by value.id');

		function test(format, result) {
			/*
			 * Eval hack to make the code displayed on the test page look
			 * nice and readable, since tests should also serve as
			 * documentation / demonstration.
			 */
			var fn = new Function('listParser', 'expect',
				'return function () { expect(\n  listParser.' +
				'test.fillDefaults(\n    \'' + format.replace(/'/g, '\\\'') +
				'\'))\n  .to.equal(\n    \'' + result.replace(/'/g, '\\\'') +
				'\');\n};');
			it(format, fn(listParser, expect));
		}


	});

	describe('Examples', function () {

		var expr = 'country.code as country.name group by country.continent for country in data.countries';
		var expected = {
			select: 'country.code',
			label: 'country.name',
			group: 'country.continent',
			value: 'country',
			source: 'data.countries',
			key: undefined,
			memo: undefined
		};

		test(expr, expected);

		function test(expr, expected) {
			var json =
				'{ ' +
					_.map(expected, function (value, key) {
							return key + ': ' + JSON.stringify(value);
					}).join(', ') +
				' }';
			var fn = new Function('listParser', 'expect',
				'return function () { expect(listParser.' +
				'test.parse(\'' + expr.replace(/'/g, '\\\'') + '\'))\n    ' +
				'.to.deep.equal(' + json + ');\n};');
			it(expr, fn(listParser, expect, _.isEqual));
		}

	});

	false && it('Log the regular expression to the console for your personal entertainment', function () {
		var parser = listParser.test.compile().parser;

		console.info('\t\tComprehension parser internals');
		console.info('\t\t * Regex (' + parser.regex.toString().length + ' chars)', parser.regex);
		console.info('\t\t * Capture group to named capture mapping table',
			_.reduce(parser.matchMaps, function (ar, values, key) {
				values.forEach(function (value) {
					ar[value] = key;
				});
				return ar;
			}, ['(n/a)']));
		console.info('Enjoy!');

	});

	describe('Performance', function () {

		var repeat = 50;
		var target = 2;

		it('Compiles the parser in under ' + target + 'ms ' +
			'(averaging over ' + repeat + ' runs)', function () {

			var start = new Date().getTime();

			for (var i = 0; i < repeat; i++) {
				listParser.test.compile();
			}

			var end = new Date().getTime();

			var duration = (end - start) / repeat;

			expect(duration).to.be.below(target);

			console.info('Average compile time for list comprehension ' +
				'parser: ' + duration.toFixed(2) + 'ms');

		});

		it('Parses all ' + ngOptions.length + ' Angular ngOptions ' +
			'examples in under ' + target + 'ms (averaging over ' +
			repeat + ' runs)', function () {

			var start = new Date().getTime();

			for (var i = 0; i < repeat; i++) {
				ngOptions.forEach(function (expr) {
					listParser.test.parse(expr);
				});
			}

			var end = new Date().getTime();

			var duration = (end - start) / repeat;

			expect(duration).to.be.below(target);

			console.info('Average parse time for all ' + ngOptions.length +
				' ngOptions examples: ' + duration.toFixed(2) + 'ms');

		});

	});

});
