var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var arithmetic = require('../parsers/arithmetic');
var arithmeticLanguage = require('../languages/arithmetic');
var _ = require('lodash');

/**
 * @name arithmeticParserTest
 */
describe('Arithmetic parser', function () {

	describe('Basic expressions', function() {

		it('Built-in constants', function () {
			expect(arithmetic('true').evaluate({})).to.equal(true);
			expect(arithmetic('false').evaluate({})).to.equal(false);
			expect(arithmetic('null').evaluate({})).to.equal(null);
			expect(arithmetic('undefined').evaluate({})).to.equal(undefined);
		});

		it('Constant expressions', function () {
			expect(arithmetic('42').evaluate({})).to.equal(42);
			expect(arithmetic('42.23').evaluate({})).to.equal(42.23);
			expect(arithmetic('0x42').evaluate({})).to.equal(0x42);
			expect(arithmetic('"string"').evaluate({})).to.equal("string");
			expect(arithmetic("'cheese'").evaluate({})).to.equal('cheese');
			expect(arithmetic('"str\\"ing"').evaluate({})).to.equal("str\"ing");
			expect(arithmetic("'str\\'ing'").evaluate({})).to.equal('str\'ing');
		});

		it('Simple expressions on scope', function () {
			expect(arithmetic('value').evaluate({ value: 101 })).to.equal(101);
			expect(arithmetic('value.prop').evaluate({ value: { prop: 102 } })).to.equal(102);
			expect(arithmetic('value[1]').evaluate({ value: [103, 104, 105] })).to.equal(104);
			expect(arithmetic('value(106)').evaluate({ value: function (v) { return v; } })).to.equal(106);
		});

		it('Compound expressions on scope', function () {
			expect(arithmetic('value.func(107)').evaluate({ value: { func: function (v) { return 107; } } })).to.equal(107);
			expect(arithmetic('value[1](108)').evaluate({ value: [function () { return 111; }, function (v) { return v; }] })).to.equal(108);
			expect(arithmetic('value.func(112)[1]').evaluate({ value: { func: function (v) { return [113, v, 114]; } } })).to.equal(112);
		});

		it('Arithmetic', function () {
			expect(arithmetic('5 + 2').evaluate({})).to.equal(7);
			expect(arithmetic('5 - 2').evaluate({})).to.equal(3);
			expect(arithmetic('5 * 2').evaluate({})).to.equal(10);
			expect(arithmetic('5 / 2').evaluate({})).to.equal(2.5);
			expect(arithmetic('5 % 2').evaluate({})).to.equal(1);
			expect(arithmetic('2 - -4').evaluate({})).to.equal(6);
			expect(arithmetic('2 - +4').evaluate({})).to.equal(-2);
			expect(arithmetic('3 & 18').evaluate({})).to.equal(2);
			expect(arithmetic('3 | 18').evaluate({})).to.equal(19);
			expect(arithmetic('3 ^ 18').evaluate({})).to.equal(17);
			expect(arithmetic('~63 & 255').evaluate({})).to.equal(192);
		});

		it('Boolean logic', function () {
			expect(arithmetic('!true').evaluate({})).to.equal(false);
			expect(arithmetic('!false').evaluate({})).to.equal(true);
			expect(arithmetic('!!true').evaluate({})).to.equal(true);
			expect(arithmetic('!!false').evaluate({})).to.equal(false);
			expect(arithmetic('true && true').evaluate({})).to.equal(true);
			expect(arithmetic('true && false').evaluate({})).to.equal(false);
			expect(arithmetic('false && true').evaluate({})).to.equal(false);
			expect(arithmetic('false && false').evaluate({})).to.equal(false);
			expect(arithmetic('true || true').evaluate({})).to.equal(true);
			expect(arithmetic('true || false').evaluate({})).to.equal(true);
			expect(arithmetic('false || true').evaluate({})).to.equal(true);
			expect(arithmetic('false || false').evaluate({})).to.equal(false);
		});

		it('Order of operations', function () {
			expect(arithmetic('true && false || false && true').evaluate({})).to.equal(false);
			expect(arithmetic('false || false && true || false').evaluate({})).to.equal(false);
			expect(arithmetic('1 - 1 + 1 + 3 * 4 / 2 * 5').evaluate({})).to.equal(31);
			expect(arithmetic('((3 + 4) * (7 - 2) + 1) / 6').evaluate({})).to.equal(6);
		});

		it('Indirection chains', function () {
			expect(arithmetic('func(3)(4)[0].value').evaluate({ func: function (a) { return function (b) { return [{ value: a + 2 * b }]; }; } })).to.equal(11);
			expect(arithmetic('arr[0][1][2]').evaluate({ arr: [[[0,1,2], [3,4,5]], [[6,7,8], [9,10,11]]] })).to.equal(5);
		});

		it('Ternary operator', function () {
			expect(arithmetic('true ? 1 : 2').evaluate({})).to.equal(1);
			expect(arithmetic('false ? 1 : 2').evaluate({})).to.equal(2);
			expect(arithmetic('5 + 0 ? 1 + 2 : 2 + 3').evaluate({})).to.equal(3);
			expect(arithmetic('0 * 5 ? 1 + 2 : 2 + 3').evaluate({})).to.equal(5);
		});

	});

	describe('Writables', function () {

		it('Directly to scope (requires rawScope=true)', function() {
			var scope = { value: undefined };
			arithmetic('value').set(scope, 'a');
			expect(scope.value).to.be.equal(undefined);
			arithmetic('value', { rawScope: true }).set(scope, 'b');
			expect(scope.value).to.be.equal('b');
		});

		it('Via indirection', function() {
			var scope = { key: 'test', data: { array: [1, 2, 3], object: {}, value: null } };
			arithmetic('data.array[1]').set(scope, 4);
			expect(scope.data.array.join(',')).to.be.equal('1,4,3');
			arithmetic('data.object[key]').set(scope, 'lol');
			expect(scope.data.object.test).to.be.equal('lol');
			arithmetic('data.value').set(scope, 3.14);
			expect(scope.data.value).to.be.equal(3.14);
		});

	});

	describe('Strict mode', function () {

		it('Strict mode: throws on attempt to access non-existant global', function () {
			var scope = { object: {} };
			expect(function () { arithmetic('doesntExist').evaluate(scope); }).to.throw();
			expect(function () { arithmetic('object.doesntExist').evaluate(scope); }).to.not.throw();
			expect(function () { arithmetic('doesntExist').set(scope, 1); }).to.throw();
			expect(function () { arithmetic('object.doesntExist').set(scope, 1); }).to.not.throw();
			expect(scope.object.doesntExist).to.be.equal(1);
		});

		it('Loose mode: does not throw on attempt to access non-existant global', function () {
			var scope = { object: {} };
			expect(function () { arithmetic('doesntExist', { notStrict: true }).evaluate(scope); }).to.not.throw();
			expect(function () { arithmetic('object.doesntExist', { notStrict: true }).evaluate(scope); }).to.not.throw();
			expect(function () { arithmetic('object.doesntExist', { notStrict: true }).set(scope, 1); }).to.not.throw();
			expect(scope.object.doesntExist).to.be.equal(1);
		});

	});

});
