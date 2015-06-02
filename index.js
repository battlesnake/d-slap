var requireDir = require('require-dir');

module.exports = {
	parsers: requireDir('./parsers'),
	languages: requireDir('./languages'),
	builder: require('./language-builder')
};
