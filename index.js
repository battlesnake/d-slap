module.exports = {
	languages: {
		arithmetic: require('./parsers/arithmetic'),
		comprehension: require('./parsers/comprehension'),
		list: require('./parsers/list')
	},
	parsers: {
		arithmetic: require('./parsers/arithmetic'),
		comprehension: require('./parsers/comprehension'),
		list: require('./parsers/list'),
		recursive: require('./parsers/recursive'),
		simple: require('./parsers/simple')
	},
	util: {
		languageBuilder: require('./util/language-builder')
	}
};
