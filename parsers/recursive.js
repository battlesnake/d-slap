var _ = require('lodash');

module.exports = recursiveParser;

recursiveParser.unparse = recursiveUnparser;

/**
 * @name recursiveParser
 *
 * @param {string} expr
 * The expression to parse
 *
 * @param {language} language
 * The language definition to use to parse the expression.
 *
 * @returns {parsetree}
 * The parse tree
 *
 * @description
 * Parses a recursive expresion as defined by the given language.
 *
 * Useful for creating recursive domain specific languages (not possible with
 * the much more efficient {@link simpleParser}).
 *
 * See the {@arithmeticLanguage} for an example.
 */
function recursiveParser(expr, language, options) {

	options = _.assign({
		/*
		 * If a subgroup start matches, but fails to start, can we backtrack and
		 * try other subgroups?
		 */
		backtrack: false,
		/*
		 * Store original match in the parse tree nodes, in a 'content' property.
		 *
		 * The source for any entity matches will be stored regardless of this
		 * setting.
		 *
		 * Each group node will contain the entire contents of that group in the
		 * source (including start/end markers of group) if this option is set.
		 */
		originalStrings: false,
	}, options);
	var backtrack = options.backtrack;
	var originalStrings = options.originalStrings;
	/*
	 * Aether defines a group that can appear anywhere, with lowest precedence
	 * in searches (unless explicitly specified in a subgroup/postgroup list).
	 *
	 * Matched aether does not produce any output.
	 *
	 * Typical use: whitespace.
	 */
	var aether = language.aether && language.terms[language.aether];

	/* Parser state: position in expression and last matched substring */
	var pos = 0;

	/* Recursively parse expression */
	return getGroup({ name: 'result', isRoot: true, subgroups: language }, '');

	/*
	 * Parse until the end of the group is reached, and return the parse
	 * tree.  Recursively parses subgroups.
	 */
	function getGroup(group, start) {
		var startPosition = pos;
		/* Consume start of group */
		consume(start.length);
		/* Is group an entity? */
		if (group.isEntity) {
			/* Return entity */
			return resultFactory('entity', {});
		}
		/* Array of matched groups */
		var groups = [], nextGroups = group.subgroups;
		while (pos < expr.length) {
			/* Look for beginning of subgroup */
			var match = tryMatchSubgroups(nextGroups);
			if (match) {
				var postgroups = match.group.postgroups;
				var samePostgroups = match.group.samePostgroups;
				nextGroups = samePostgroups ? nextGroups :
					postgroups ? postgroups : group.subgroups;
				groups.push(match.result);
				continue;
			}
			/* Look for end of current group */
			if (!group.isRoot) {
				var end = tryMatch(group.end);
				if (end) {
					/* Consume end of group */
					consume(end.length);
					/* Return group */
					return resultFactory('group', {
						start: start,
						end: end,
						groups: groups
					});
				}
			}
			if (aether && tryMatchSubgroup(aether)) {
				continue;
			}
			/* Nothing matched */
			throw new Error('Syntax error at character ' + pos + '\n> ' +
				subexp(expr, pos) + '\n  ' + subexp(space(pos - 1) + '^', pos));
		}
		function subexp(s, p) {
			if (p + 30 < s.length) {
				 s = s.substr(0, p);
			}
			if (p - 30 > 0) {
				s = s.substr(p - 30);
			}
			return s;
		}
		function space(n) { for (var s=''; n >= 0; --n) { s += ' '; } return s; }
		if (group.isRoot) {
			/* Return root */
			return resultFactory('group', {
				groups: groups
			});
		} else {
			/* End of group not reached */
			throw new Error('Unexpected end of expression (possibly unmatched' +
				' «' + start + '» at position ' + startPosition + '): ' +
				expr.substr(startPosition));
		}

		function resultFactory(type, data) {
			return _.assign(
				{
					type: group.name,
					position: startPosition,
					length: pos - startPosition
				},
				(originalStrings || type === 'entity') ? {
					content: expr.substr(startPosition, pos - startPosition)
				} : {},
				data);
		}
	}

	/*
	 * Try to match the given regular expression from the current position in
	 * the input expression.  Return matched string if match is successful, or
	 * null if it is not.  Does not consume input.
	 *
	 * If non-sticky regular expressions are used (default since node.js doesn't
	 * currently support them), a workaround is used which uses some state-info
	 * in order to improve performance.
	 */
	var exprsubstr = null, exprsubstrpos = -1;
	function tryMatch(rx) {
		var match;
		if (rx.sticky) {
			rx.lastIndex = pos;
			match = rx.match(expr);
		} else {
			/* Cache substring */
			if (exprsubstrpos !== pos) {
				exprsubstr = expr.substr(pos);
				exprsubstrpos = pos;
			}
			match = exprsubstr.match(rx);
		}
		return match ? match[0] : null;
	}

	function tryMatchSubgroups(subgroups) {
		return _(subgroups)
			.map(tryMatchSubgroup)
			.filter()
			.first();
	}

	/* Generate the subgroup for the content at the current position */
	function tryMatchSubgroup(subgroup) {
		var rx = subgroup.start;
		var start = tryMatch(subgroup.start);
		if (!start) {
			return null;
		}
		var result;
		if (backtrack) {
			/*
			 * Backtracking: allow failed attempts.  If a practical use for
			 * backtracking is found, which requires good performance, then this
			 * exception-based logic should be replaced with some more efficient
			 * logic that utilises return values.
			 */
			var oldPosition = pos;
			try {
				result = getGroup(subgroup, start);
			} catch (e) {
				pos = oldPosition;
				return null;
			}
		} else {
			/* Not backtracking: don't eat exceptions */
			result = getGroup(subgroup, start);
		}
		return {
			result: result,
			group: subgroup
		};
	}

	/* Consume some characters from the input */
	function consume(count) {
		pos += count;
		if (pos > expr.length) {
			throw new Error('Unexpected end of expression');
		} else if (pos === expr.length) {
			return false;
		} else {
			return true;
		}
	}
}

/**
 * @name recursiveUnparser
 *
 * @param {parsetree} tree
 * The parse tree
 *
 * @returns {string}
 * Expression which is invariant in a parse->unparse round-trip with the
 * given language.
 *
 * @description
 * This should be used for testing the parser, when I get around to writing unit
 * tests for it.
 *
 * Converts a parse tree generated by the {@link recursiveParser}
 * back to a string.
 */
function recursiveUnparser(tree, language) {
	return unparseNodes(tree);

	function unparseNodes(nodes) {
		return nodes.map(unparseNode).join('');
	}

	function unparseNode(node) {
		var start = node.start;
		var end = node.end;
		var middle = node.type === 'entity' ? node.content :
			unparseNodes(node.groups);
		return start + middle + end;
	}

}
