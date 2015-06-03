var requireDir = require('require-dir');

module.exports = {
	parsers: requireDir('./parsers'),
	languages: requireDir('./languages'),
	util: requireDir('./util')
};
