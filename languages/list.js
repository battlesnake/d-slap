module.exports = listLanguage();

/**
 * @ngdoc constant
 * @name listLanguage
 *
 * @description
 * Template syntax for list comprehension expressions.
 */
function listLanguage() {
	return '[{select} as] {label} [group by {group}] for [({key}, {value})|{value}] in {source} [track by {memo}]|{source}';
}
