BUN ?= $(shell command -v bun 2>/dev/null || printf '%s' "$(HOME)/.bun/bin/bun")

.PHONY: test

test:
	export PATH="$(dir $(BUN)):$$PATH"; $(BUN) run check && $(BUN) run test && $(BUN) run test:e2e
