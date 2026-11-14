.PHONY: help install build build-release api debug lint lint-bundle test test-unit test-inject test-browser test-chrome test-chrome-mv3 test-firefox test-all test-dependencies bench check
.DEFAULT_GOAL := help

CHROME_BIN ?= $(shell \
	for p in \
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
		"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary" \
		"/Applications/Chromium.app/Contents/MacOS/Chromium" \
		"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
		"$(HOME)/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do \
		if [ -x "$$p" ]; then echo "$$p"; break; fi; \
	done)
export CHROME_BIN

help: ## Show this help message
	@printf "\033[1;35mNyx\033[0m \033[90m— Makefile targets\033[0m\n\n"
	@awk 'BEGIN {FS = ":.*##"; printf "\033[1;36m%-20s\033[0m %s\n", "Target", "Description"; printf "\033[90m%-20s %s\033[0m\n", "--------------------", "----------------------------------------"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[33m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install npm dependencies cleanly
	npm ci

build: ## Build release extensions
	npm run build

build-release: ## Build release for specific targets (ARGS="--chrome ...")
	node tasks/cli.js build --release $(ARGS)

api: ## Build standalone API (darkreader.js / darkreader.mjs)
	npm run api

debug: ## Build debug extensions
	npm run debug

lint: ## Run ESLint and code-style checks
	npm run lint

lint-bundle: ## Lint built extension bundles
	npm run lint:bundle

test: ## Run unit test suite
	npm test

test-unit: ## Run Jest unit tests (pass ARGS=...)
	npm run test:unit $(if $(ARGS),-- $(ARGS))

test-inject: ## Run Karma inject tests (pass ARGS=...)
	npm run test:inject $(if $(ARGS),-- $(ARGS))

test-browser: ## Run all browser e2e tests (Chrome, MV3, Firefox)
	npm run test:browser

test-chrome: ## Run Chrome MV2 browser tests
	npm run test:chrome $(if $(ARGS),-- $(ARGS))

test-chrome-mv3: ## Run Chrome MV3 browser tests
	npm run test:chrome-mv3 $(if $(ARGS),-- $(ARGS))

test-firefox: ## Run Firefox browser tests
	npm run test:firefox $(if $(ARGS),-- $(ARGS))

test-all: ## Run full test suite
	npm run test:all

test-dependencies: ## Check dependency security/allowlist
	node tests/dependencies.js

bench: ## Run performance benchmarks (pass ARGS=...)
	npm run bench $(if $(ARGS),-- $(ARGS))

check: lint test build api ## Run lint, unit tests, build, and API build
