var _ = require('lodash');
var simpleParser = require('./simple');
var comprehensionLanguage = require('../languages/comprehension');

/**
 * @name comprehensionParser
 *
 * @param {string} comprehension
 * The comprehension to parse
 *
 * @return {function}
 * This function takes a comprehension expression and returns an object
 * containing the captured values.
 *
 * @description
 * A function which generates a comprehension parser for any given
 * comprehension template.  The generated comprehension parser parses
 * comprehensions which match the template syntax, and returns captured
 * expressions as key/value pairs in a returned object.
 *
 * This service generates a comprehension parser from the given comprehension
 * syntax.  The comprehension syntax is specified using the
 * {@link comprehensionLanguage}.
 *
 * The function parses the comprehension syntax using the
 * {@link simpleParser}, then builds a regular
 * expression from the parse tree and builds a mapping table which maps from
 * the regular expression's numbered capture groups to the named capture
 * groups as specified by the comprehension syntax.  Thus, re-using a parser to
 * parse many expressions is pretty quick as the actual string parsing is done
 * by native code (the RegExp engine).
 *
 * @todo
 * Decouple this from the comprehensionLanguage, so that the regex compiler
 * and capture engine can operate on any language specification which
 * implements a subset of the features of the comprehension language (using
 * the same naming).
 *
 * @example
 * See {@comprehensionParserTest}
 */

module.exports = comprehensionParserFactory;

/**
 * @name comprehensionParserFactory
 * @private
 *
 * @description
 * See {@link comprehensionLanguage}
 */
function comprehensionParserFactory(comprehension) {
	var parseTree = parseComprehensionSyntax(comprehension);
	var comprehensionParser = compileComprehensionParser(parseTree);

	parseComprehension.parser = comprehensionParser;

	return parseComprehension;

	/**
	 * @function parseComprehension
	 * @private
	 *
	 * @param {string} value
	 * The comprehension expression to parse
	 *
	 * @description
	 * Apply the comprehension regex and pack the results
	 */
	function parseComprehension(value) {
		var matches = value.match(comprehensionParser.regex);
		if (!matches) {
			return undefined;
		}
		var matchMaps = comprehensionParser.matchMaps;

		return _.reduce(matchMaps, function (result, indices, name) {
			result[name] = getCapture(name, indices);
			return result;
		}, {});

		/* Get the value of a capture */
		function getCapture(name, indices) {
			var captured = indices.filter(function (index) {
				return matches[index] !== undefined;
			});
			if (captured.length === 0) {
				return undefined;
			} else if (_.uniq(captured).length > 1) {
				throw new Error('Multiple matches found for key "' + name + '": ' + captured.join(', '));
			} else {
				return '' + matches[captured[0]];
			}
		}
	}
}

/* Converts a comprehension spec to a parse tree */
function parseComprehensionSyntax(sentence) {
	return simpleParser(sentence, comprehensionLanguage);
}

/*
 * Generates a parser regex and a capture-index mapping from a
 * comprehension parse tree
 */
function compileComprehensionParser(parseTree) {
	optimizeWhitespace(parseTree);
	/*
	 * If you want to see what optimizeWhitespace does, use the
	 * simpleUnparseService to convert the resulting parse tree back to
	 * a string, and log it to the console along with the original
	 * string that was parsed.
	 */
	var root = parseTree;
	var compiler = {
		text: text,
		whitespace: whitespace,
		capture: capture,
		options: options,
		choice: choice
	};
	var captureIndex = 0;
	var matchMaps = {};
	/* Match entire string but allow whitespace at the ends */
	var rx = reduceWhitespace('^\\s*' + group(root) + '\\s*$');
	return {
		regex: new RegExp(rx, 'i'),
		matchMaps: matchMaps
	};

	/*
	 * This function makes whitespace behave more as the service's user
	 * would expect it to (i.e. whitespace cannot be omitted).  If for
	 * whatever reason you don't like this function, it can be removed
	 * iff the whitespace generator's expression is replaced with \s*
	 * instead of \s+
	 */
	function optimizeWhitespace(nodes) {
		if (!nodes || !nodes.length) {
			return nodes;
		}

		labelNodes(nodes);
		consolidateWhitespace(nodes);
		addWhitespaceOption(nodes);

		/* Recurse */
		nodes.forEach(function (node) {
			if (node.options) {
				optimizeWhitespace(node.value);
			}
			/* Clean up */
			delete node.optional;
			delete node.options;
			delete node.whitespace;
			delete node.addWhitespaceAfter;
			delete node.addWhitespaceBefore;
		});

		return nodes;

		/* Makes life easier for the other stages */
		function labelNodes(nodes) {
			nodes.forEach(function (node) {
				if (node.type === 'options') {
					node.options = true;
					if (!_.findWhere(node.value, { type: 'choice' })) {
						node.optional = true;
					}
				}
				if (node.type === 'whitespace') {
					node.whitespace = true;
				}
			});
		}

		/*
		 * If whitespace is adjacent to an optional, have the optional
		 * engulf it and also mark the optional for replacement with a
		 * choice between its contents and whitespace (see
		 * addWhitespaceOption).  Also reduce consecutive whitespace
		 * nodes to one whitespace node.
		 */
		function consolidateWhitespace(nodes) {
			var prev, curr, next;
			var i = 0;
			while (i < nodes.length) {
				prev = (i > 0) && nodes[i - 1];
				curr = nodes[i];
				next = (i < nodes.length - 2) && nodes[i + 1];
				if (prev.whitespace && curr.whitespace) {
					nodes.splice(i, 1);
					continue;
				} else if (curr.optional) {
					if (next && next.whitespace) {
						nodes.splice(i + 1, 1);
						curr.value.push(next);
						curr.addWhitespaceAfter = true;
						continue;
					} else if (prev && prev.whitespace) {
						nodes.splice(i - 1, 1);
						curr.value.unshift(prev);
						curr.addWhitespaceBefore = true;
						i--;
						continue;
					}
				}
				i++;
			}
		}

		/*
		 * If an optional group has engulged whitespace, and not from the
		 * end of a subexpression, then replace the optional with a
		 * choice between its contents or mandatory whitespace
		 */
		function addWhitespaceOption(nodes) {
			for (var i = 0; i < nodes.length; i++) {
				var node = nodes[i];
				var first = i === 0 || nodes[i - 1].type === 'choice';
				var last = i === nodes.length - 1 || nodes[i + 1].type === 'choice';
				if (node.addWhitespaceBefore && !last ||
					node.addWhitespaceAfter && !first) {
					node.value.push({ type: 'choice' });
					node.value.push({ type: 'whitespace' });
				}
			}
		}

	}

	/*
	 * Reduce consecutive whitespace.  The preprocessor does not catch
	 * all of it
	 */
	function reduceWhitespace(rx) {
		return rx
			.replace(/(\\s\*){2,}/g, '\\s*')
			.replace(/(\\s[\+\*]){2,}/g, '\\s+');
	}

	/* Compile a node */
	function compile(node) {
		return compiler[node.type](node.value);
	}

	/* Output non-capturing group */
	function group(subexpr) {
		return '(?:' + subexpr.map(compile).join('\\s*') + ')';
	}

	/* Output optional group or choice group */
	function options(subexpr) {
		/*
		 * Non-capturing optional group unless it contains a "choice"
		 * entity as an immediate child token (in which case the group
		 * is not optional).
		 */
		var isChoice = subexpr
			.some(function (expr) { return expr.type === 'choice'; });
		return group(subexpr) + (isChoice ? '' : '?');
	}

	/* Separate choices */
	function choice() {
		/*
		 * This character serves the same purpose in regular expressions
		 * as it does in comprehension expressions - which makes the
		 * implementation really really easy.
		 */
		return '|';
	}

	/* Output capture group */
	function capture(subexpr) {
		var name = subexpr[0].value;
		if (!_.has(matchMaps, name)) {
			matchMaps[name] = [];
		}
		/*
		 * We create two capture groups in the regex:
		 *   Bare identifier: \b(?!{\[)(\S+)
		 *   Braced identifier: (?:{\[)(.+?)(?:\]})
		 */
		matchMaps[name].push(++captureIndex);
		matchMaps[name].push(++captureIndex);
		return '(?:(?:{\\[)(.+?)(?:\\]})|\\b(?!{\\[)(\\S+))';
	}

	/* Output text */
	function text(val) {
		return val.replace(/[\^\$\.\+\*\?\[\]\(\)\|]/g, '\\$&');
	}

	/* Output whitespace */
	function whitespace() {
		return '\\s+';
	}
}
