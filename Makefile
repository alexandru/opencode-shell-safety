BUN ?= $(shell command -v bun 2>/dev/null || printf '%s' "$(HOME)/.bun/bin/bun")

.PHONY: test publish upgrade-dependencies

test:
	export PATH="$(dir $(BUN)):$$PATH"; $(BUN) run check && $(BUN) run test && $(BUN) run test:e2e

publish: test
	export PATH="$(dir $(BUN)):$$PATH"; $(BUN) pm pack --dry-run && npm publish --access public

upgrade-dependencies:
	export PATH="$(dir $(BUN)):$$PATH"; $(BUN) update --latest --exact
