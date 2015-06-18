var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var comprehensionParser = require('../parsers/comprehension');

/**
 * @name comprehensionParserTest
 */
describe('Comprehension parser', function () {

	describe('Matches text', function () {

		it('Returns result for correct text match', function () {
			var comp = 'this is valid';
			var expr = 'this is valid';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
		});

		it('Returns undefined for incorrect text match', function () {
			var comp = 'this is valid';
			var expr = 'this is invalid';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.equal(undefined);
		});

		it('Doesn\'t care much about whitespace', function () {
			var comp = 'this is valid';
			var expr = '\t\n  this   is\tvalid\n  ';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
		});

		it('Cares enough about whitespace', function () {
			var comp = 'this is valid';
			var expr = 'thisisvalid';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.equal(undefined);
		});

	});

	it('Parses capture group', function () {
		var comp = '{capture}';
		var expr = 'identifier';
		var parser = comprehensionParser(comp);
		var parsed = parser(expr);
		expect(parsed.capture).to.equal('identifier');
	});

	it('Parses JS identifiers as capture group', function () {
		var comp = '{select} from {collection} where {key} = {value}';
		var expr = 'item from model.items[mv.itemIndex] where item.id = 42';
		var parser = comprehensionParser(comp);
		var parsed = parser(expr);
		expect(parsed.select).to.equal('item');
		expect(parsed.collection).to.equal('model.items[mv.itemIndex]');
		expect(parsed.key).to.equal('item.id');
		expect(parsed.value).to.equal('42');
	});

	it('Return undefined for for invalid comprehension', function () {
		var comp = '{capture}';
		var expr = '';
		var parser = comprehensionParser(comp);
		var parsed = parser(expr);
		expect(parsed).to.equal(undefined);
	});

	describe('Parses optional groups correctly', function () {

		it('Captures groups in correct order', function () {
			var comp = '{a} [[{b}] {c}]';
			var expr = 'alpha beta gamma';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal('beta');
			expect(parsed.c).to.equal('gamma');
		});

		it('Captures groups in correct order when a group is omitted', function () {
			var comp = '{a} [[{b}] {c}]';
			var expr = 'alpha gamma';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal(undefined);
			expect(parsed.c).to.equal('gamma');

		});

		it('Captures groups in the correct order when multiple groups are omitted', function () {
			var comp = '{a} [[{b}] {c}]';
			var expr = 'alpha';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal(undefined);
			expect(parsed.c).to.equal(undefined);
		});

	});

	describe('Parses choices correctly', function () {

		it('Case #1', function () {
			var comp = '[{a} and {b} and {c}|only {b}|{a} or {b}|{a} and {c}]';
			var expr = 'alpha and beta and gamma';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal('beta');
			expect(parsed.c).to.equal('gamma');
		});

		it('Case #2', function () {
			var comp = '[{a} and {b} and {c}|only {b}|{a} or {b}|{a} and {c}]';
			var expr = 'only beta';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal(undefined);
			expect(parsed.b).to.equal('beta');
			expect(parsed.c).to.equal(undefined);
		});

		it('Case #3', function () {
			var comp = '[{a} and {b} and {c}|only {b}|{a} or {b}|{a} and {c}]';
			var expr = 'alpha or beta';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal('beta');
			expect(parsed.c).to.equal(undefined);
		});

		it('Case #4', function () {
			var comp = '[{a} and {b} and {c}|only {b}|{a} or {b}|{a} and {c}]';
			var expr = 'alpha and gamma';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal(undefined);
			expect(parsed.c).to.equal('gamma');
		});

	});

	describe('One choice from a set must be specified', function () {

			it('Parses correctly when required choice is specified', function () {
				var comp = 'test [{a}|{a} and {b}]';
				var parser = comprehensionParser(comp);
				var expr = 'test alpha and beta';
				var parsed = parser(expr);
				expect(parsed.a).to.equal('alpha');
				expect(parsed.b).to.equal('beta');
			});

			it('Returns undefined when required choice is not specified', function () {
				var comp = 'test [{a}|{a} and {b}]';
				var parser = comprehensionParser(comp);
				var expr = 'test';
				var parsed = parser(expr);
				expect(parsed).to.equal(undefined);
			});

	});

	describe('Choice in an option block is optional', function () {

			it('Parses correctly when optional choice is specified', function () {
				var comp = 'test [[{a}|{a} and {b}]]';
				var expr = 'test alpha and beta';
				var parser = comprehensionParser(comp);
				var parsed = parser(expr);
				expect(parsed.a).to.equal('alpha');
				expect(parsed.b).to.equal('beta');
			});

			it('Returns a result when optional choice is not specified', function () {
				var comp = 'test [[{a}|{a} and {b}]]';
				var expr = 'test';
				var parser = comprehensionParser(comp);
				var parsed = parser(expr);
				expect(parsed).to.not.equal(undefined);
			});

	});

	describe('Choice with blank option is effectively optional', function () {

		it('Parses correctly when choice is specified', function () {
			var comp = 'test [[{a}|{a} and {b}]]';
			var expr = 'test alpha and beta';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed.a).to.equal('alpha');
			expect(parsed.b).to.equal('beta');
		});

		it('Returns a result when choice is not specified', function () {
			var comp = 'test [[{a}|{a} and {b}]]';
			var expr = 'test';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
			expect(parsed.a).to.equal(undefined);
			expect(parsed.b).to.equal(undefined);
		});

	});

	describe('Brace-grouped captures', function () {

		it('Parses braced group and removes braces', function () {
			var comp = '{capture}';
			var expr = '{[value]}';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
			expect(parsed.capture).to.equal('value');
		});

		it('Parses braced group containing whitespace and removes braces', function () {
			var comp = '{capture}';
			var expr = '{[func(item.id, item.text)]}';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
			expect(parsed.capture).to.equal('func(item.id, item.text)');
		});

		it('Parses braced group containing whitespace and "next" text block and removes braces', function () {
			var comp = 'select {capture} as something';
			var expr = 'select {[func(item.id, "as crazy as something gets")]} as something';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
			expect(parsed.capture).to.equal('func(item.id, "as crazy as something gets")');
		});

		it('Fails on unclosed escape braces', function () {
			var comp = 'select {capture} as something';
			var expr = 'select {[func(item.id, "as crazy as something gets")} as something';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.equal(undefined);
		});

		it('Is fine with nested single-braces', function () {
			var comp = 'select {capture} as something';
			var expr = 'select {[func({ id: item[0], value: item[1] })]} as something';
			var parser = comprehensionParser(comp);
			var parsed = parser(expr);
			expect(parsed).to.not.equal(undefined);
			expect(parsed.capture).to.equal('func({ id: item[0], value: item[1] })');
		});

	});

});
