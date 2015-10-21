#!/bin/bash

set -euo pipefail

declare -r out='test-results'

mocha tests

mkdir -p -- "${out}"

if ! mocha tests -R doc > "${out}/tests.html"; then
	rm -- "${out}/tests.html"
	false
fi

if ! mocha --require blanket tests -R html-cov > "${out}/coverage.html"; then
	rm -- "${out}/coverage.html"
	false
fi
