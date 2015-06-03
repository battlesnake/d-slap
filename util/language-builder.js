var _ = require('lodash');

module.exports = languageBuilder;

/**
 * @name languageBuilder
 *
 * @param {language_spec} spec
 * The language specification, with references being by name (using strings)
 *
 * @returns {language}
 * A language spec (using direct object references) that can be used with the
 * {@link simpleParser}
 *
 * @description
 * Builds a language definition.
 * Resolves cross-references (specified in string format), and allows
 * phrases (token groups) to be defined externally to the token subgroups
 * property, allowing re-use of phrases in multiple subgroups.  This makes
 * the language definition syntax cleaner and more maintainable than the raw
 * syntax which the simple parser requires.
 *
 * Can also be used to build recursive-language specifications (not supported by
 * the {@link simpleParser}).
 *
 * @example
 * Used by {@link comprehensionParser} see {@link comprehensionLanguage}.
 * Used by {@link arithmeticParser} see {@link arithmeticLanguage}.
 *
 * Prevents you having to declare separate variables for groups and resolve
 * ordering yourself.
 */
function languageBuilder(spec, options) {

	options = _.assign({
		/* Convert all start/end/entity expressions to regular expressions */
		parseMarkers: false,
		/* Generate sticky regular expressions */
		stickyRx: false
	}, options);

	var parseMarkers = options.parseMarkers;
	var stickyRx = options.stickyRx;

	var terms = {};

	if (!spec.$root) {
		throw new Error('Language root not specified');
	}
	/* Recursively resolve references */
	var root = _(resolve(spec.$root)).flattenDeep().uniq().value();
	/*
	 * Ensure that all terms are processed, even those that the language spec
	 * doesn't reference
	 */
	_.each(spec, function (value, name) {
		resolve(name, null);
	});
	/* Flatten terms */
	_.each(terms, function (term, name) {
		terms[name] = _.flattenDeep([term])[0];
	});
	/* Flatten group lists */
	_.each(terms, function (term, name) {
		flatten(term.subgroups);
		flatten(term.postgroups);
	});
	root.terms = terms;
	return _.assign(root, options.extra);

	function flatten(arr) {
		if (!arr) {
			return;
		}
		var len = arr.length;
		var args = [0, len].concat(_(arr).flattenDeep().uniq().value());
		[].splice.apply(arr, args);
	}

	function resolve(group, name) {
		if (typeof group === 'string') {
			/* Name of term */
			if (group in terms) {
				/* Already resolved */
				return terms[group];
			} else if (group in spec) {
				/* Not resolved, but exists */
				/*
				 * Assign value in lookup table before resolving, so groups that
				 * recursively reference themselves can be resolved
				 */
				var value = [];
				terms[group] = value;
				value.push(resolve(spec[group], group));
				return value;
			} else {
				/* Not found */
				throw new Error('Cannot resolve "' + group + '"');
			}
		} else if (group instanceof Array) {
			/* Array of term names */
			return _(group)
				.map(resolve)
				.value();
		} else if (typeof group === 'object') {
			/* Term definition */
			if (typeof name !== 'string') {
				throw new Error('Internal error, received no name');
			}
			var term = convertTerm(name, group);
			if (term.subgroups) {
				term.subgroups = resolve(term.subgroups);
			}
			if (term.postgroups) {
				term.postgroups = resolve(term.postgroups);
			}
			return [term];
		}
		throw new Error('Group is not a term list or term definition');
	}

	function convertTerm(name, definition) {
		var start, end, isEntity;
		isEntity = 'entity' in definition;
		if (isEntity) {
			start = definition.entity;
			end = definition.entity;
			if (('start' in definition) || ('end' in definition)) {
				throw new Error('Entity cannot have separate start/end values');
			}
			if (definition.subgroups) {
				throw new Error('Entity cannot have subgroups');
			}
		} else if ('start' in definition && 'end' in definition) {
			start = definition.start;
			end = definition.end;
		} else {
			throw new Error('Invalid term definition for "' + name + '"');
		}
		if (parseMarkers) {
			start = parseMarker(start);
			if (definition.start === definition.end) {
				end = start;
			} else {
				end = parseMarker(end);
			}
		}
		return _(definition)
			.omit(['start', 'end', 'entity'])
			.assign({
				name: name,
				start: start,
				end: end,
				isEntity: isEntity
			})
			.value();
	}

	/*
	 * Parse a marker.
	 */
	function parseMarker(marker) {
		var source = '';
		var flags = [];
		if (marker instanceof RegExp) {
			source = marker.source;
			flags = [
				source.global ? 'g' : '',
				source.ignoreCase ? 'i' : '',
				source.multiline ? 'm' : '',
				source.sticky ? 'y' : '',
//				source.unicode ? 'u' : '',
			];
		} else if (typeof marker === 'string') {
			source = escapeRxStr(marker);
		} else if (marker instanceof Array) {
			source = marker.map(escapeRxStr).join('|');
		}
		if (stickyRx) {
			flags.push('y');
			return new RegExp(source, _.uniq(flags).join(''));
		} else {
			flags = _.without(flags, 'y');
			return new RegExp('^(' + source + ')', _.uniq(flags).join(''));
		}
	}

	function escapeRxStr(str) {
		return str.replace(/([\\\.\+\*\?\{\}\[\]\(\)\^\$\|])/g, '\\$1');
	}

}
