var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var arithmeticParser = require('../parsers/arithmetic');
var arithmeticLanguage = require('../languages/arithmetic');
var _ = require('lodash');

/**
 * @name recursive-parser
 */
describe('Arithmetic parser', function () {

	describe('Basic expressions', function() {
		
		it('Built-in constants', function () {
			expect(arithmeticParser('true').evaluate({})).to.equal(true);
			expect(arithmeticParser('false').evaluate({})).to.equal(false);
			expect(arithmeticParser('null').evaluate({})).to.equal(null);
			expect(arithmeticParser('undefined').evaluate({})).to.equal(undefined);
		});

		it('Constant expressions', function () {
			expect(arithmeticParser('42').evaluate({})).to.equal(42);
			expect(arithmeticParser('42.23').evaluate({})).to.equal(42.23);
			expect(arithmeticParser('0x42').evaluate({})).to.equal(0x42);
			expect(arithmeticParser('"string"').evaluate({})).to.equal("string");
			expect(arithmeticParser("'cheese'").evaluate({})).to.equal('cheese');
			expect(arithmeticParser('"str\\"ing"').evaluate({})).to.equal("str\"ing");
			expect(arithmeticParser("'str\\'ing'").evaluate({})).to.equal('str\'ing');
		});

		it('Simple expressions on scope', function () {
			expect(arithmeticParser('value').evaluate({ value: 101 })).to.equal(101);
			expect(arithmeticParser('value.prop').evaluate({ value: { prop: 102 } })).to.equal(102);
			expect(arithmeticParser('value[1]').evaluate({ value: [103, 104, 105] })).to.equal(104);
			expect(arithmeticParser('value(106)').evaluate({ value: function (v) { return v; } })).to.equal(106);
		});

		it('Compound expressions on scope', function () {
			expect(arithmeticParser('value.func(107)').evaluate({ value: { func: function (v) { return 107; } } })).to.equal(107);
			expect(arithmeticParser('value[1](108)').evaluate({ value: [function () { return 111; }, function (v) { return v; }] })).to.equal(108);
			expect(arithmeticParser('value.func(112)[1]').evaluate({ value: { func: function (v) { return [113, v, 114]; } } })).to.equal(112);
		});

		it('Arithmetic', function () {
			expect(arithmeticParser('5 + 2').evaluate({})).to.equal(7);
			expect(arithmeticParser('5 - 2').evaluate({})).to.equal(3);
			expect(arithmeticParser('5 * 2').evaluate({})).to.equal(10);
			expect(arithmeticParser('5 / 2').evaluate({})).to.equal(2.5);
			expect(arithmeticParser('5 % 2').evaluate({})).to.equal(1);
			expect(arithmeticParser('2 - -4').evaluate({})).to.equal(6);
			expect(arithmeticParser('2 - +4').evaluate({})).to.equal(-2);
			expect(arithmeticParser('3 & 18').evaluate({})).to.equal(2);
			expect(arithmeticParser('3 | 18').evaluate({})).to.equal(19);
			expect(arithmeticParser('3 ^ 18').evaluate({})).to.equal(17);
			expect(arithmeticParser('~63 & 255').evaluate({})).to.equal(192);
		});

		it('Boolean logic', function () {
			expect(arithmeticParser('!true').evaluate({})).to.equal(false);
			expect(arithmeticParser('!false').evaluate({})).to.equal(true);
			expect(arithmeticParser('!!true').evaluate({})).to.equal(true);
			expect(arithmeticParser('!!false').evaluate({})).to.equal(false);
			expect(arithmeticParser('true && true').evaluate({})).to.equal(true);
			expect(arithmeticParser('true && false').evaluate({})).to.equal(false);
			expect(arithmeticParser('false && true').evaluate({})).to.equal(false);
			expect(arithmeticParser('false && false').evaluate({})).to.equal(false);
			expect(arithmeticParser('true || true').evaluate({})).to.equal(true);
			expect(arithmeticParser('true || false').evaluate({})).to.equal(true);
			expect(arithmeticParser('false || true').evaluate({})).to.equal(true);
			expect(arithmeticParser('false || false').evaluate({})).to.equal(false);
		});

		it('Order of operations', function () {
			expect(arithmeticParser('true && false || false && true').evaluate({})).to.equal(false);
			expect(arithmeticParser('false || false && true || false').evaluate({})).to.equal(false);
			expect(arithmeticParser('1 - 1 + 1 + 3 * 4 / 2 * 5').evaluate({})).to.equal(31);
			expect(arithmeticParser('((3 + 4) * (7 - 2) + 1) / 6').evaluate({})).to.equal(6);
		});

		it('Indirection chains', function () {
			expect(arithmeticParser('func(3)(4)[0].value').evaluate({ func: function (a) { return function (b) { return [{ value: a + 2 * b }]; }; } })).to.equal(11);
			expect(arithmeticParser('arr[0][1][2]').evaluate({ arr: [[[0,1,2], [3,4,5]], [[6,7,8], [9,10,11]]] })).to.equal(5);
		});

		it('Ternary operator', function () {
			expect(arithmeticParser('true ? 1 : 2').evaluate({})).to.equal(1);
			expect(arithmeticParser('false ? 1 : 2').evaluate({})).to.equal(2);
			expect(arithmeticParser('5 + 0 ? 1 + 2 : 2 + 3').evaluate({})).to.equal(3);
			expect(arithmeticParser('0 * 5 ? 1 + 2 : 2 + 3').evaluate({})).to.equal(5);
		});

	});

	describe('Writables', function () {

		it('Directly to scope (requires dontWrap=true)', function() {
			var scope = { };
			arithmeticParser('value').set(scope, 'a');
			expect(scope.value).to.be.equal(undefined);
			arithmeticParser('value', true).set(scope, 'b');
			expect(scope.value).to.be.equal('b');
		});

		it('Via indirection', function() {
			var scope = { key: 'test', data: { array: [1, 2, 3], object: {}, value: null } };
			arithmeticParser('data.array[1]').set(scope, 4);
			expect(scope.data.array.join(',')).to.be.equal('1,4,3');
			arithmeticParser('data.object[key]').set(scope, 'lol');
			expect(scope.data.object.test).to.be.equal('lol');
			arithmeticParser('data.value').set(scope, 3.14);
			expect(scope.data.value).to.be.equal(3.14);
		});

	});

});
