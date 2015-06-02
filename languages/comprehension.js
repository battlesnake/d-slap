var languageBuilder = require('../language-builder');

module.exports = comprehensionLanguage();

/**
 * @name comprehensionLanguage
 *
 * @description
 * Domain specific language for comprehension expressions
 *
 * Is passed to the {@link simpleParseService} to parse comprehension
 * expression templates.
 *
 * Named capture:
 *
 *  * `{capture-name}`
 *
 *  * The captured expression is terminated by white-space
 *
 *  * To specify an expression that includes white-space, enclose it in
 *    a brace-square bracketing:
 *    `{[ myFunction(arg1, arg2, arg3) ]}`
 *
 * Optional group or choice:
 *
 *  * `[optional subexpression] [choice|other-choice]`
 *
 *  * `[[optional|choice]]`
 *
 *  * Note that `[option]` results in the same behaviour as `[option|]`
 *
 *  * Options may contain captures, text literals, and more options
 *
 * Choice:
 *
 *  * Entity which if present, separates the current expression into several
 *    possible choices
 *
 * See {@link languageBuilderService}
 *
 * Note that due to the final parser being formulated as a regular expression,
 * the comprehension language may only describe Chomsky type-3 grammars.
 * Specifically, this forbids recursion.
 *
 * @example
 *
 * select {column} from {table} [order by {sort} [[asc|desc]]] [limit {count}]
 *
 * [[[{select} as] {label} [group by {grouping}] for] [({key}, {value})|{value}] in] {source} [track by {trackexpr}]
 */
function comprehensionLanguage() {
	var spaces = ' \t\n'.split('');
	return languageBuilder(
		{
			$root: 'expression',
			expression: ['capture', 'options', 'choice', 'whitespace'],
			/* Captures are specified as {capture-name} */
			capture: { start: '{', end: '}' },
			/* Optional groups are specified as [stuff], equivalent to [stuff|] */
			options: { start: '[', end: ']', subgroups: ['expression'] },
			/* Choices are specified as [this|that], one option MUST be chosen */
			choice: { start: '|', end: '|' },
			/* White space */
			whitespace: { start: spaces, end: spaces },
		});
}
