.PHONY: help install build build-release api debug lint lint-bundle test test-unit test-inject test-browser test-chrome test-chrome-mv3 test-firefox test-all test-dependencies bench check

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

help:
	@echo "Targets: install build build-release api debug lint lint-bundle test test-unit test-inject test-browser test-chrome test-chrome-mv3 test-firefox test-all test-dependencies bench check"

install:
	npm ci

build:
	npm run build

build-release:
	node tasks/cli.js build --release $(ARGS)

api:
	npm run api

debug:
	npm run debug

lint:
	npm run lint

lint-bundle:
	npm run lint:bundle

test:
	npm test

test-unit:
	npm run test:unit $(if $(ARGS),-- $(ARGS))

test-inject:
	npm run test:inject $(if $(ARGS),-- $(ARGS))

test-browser:
	npm run test:browser

test-chrome:
	npm run test:chrome $(if $(ARGS),-- $(ARGS))

test-chrome-mv3:
	npm run test:chrome-mv3 $(if $(ARGS),-- $(ARGS))

test-firefox:
	npm run test:firefox $(if $(ARGS),-- $(ARGS))

test-all:
	npm run test:all

test-dependencies:
	node tests/dependencies.js

bench:
	npm run bench $(if $(ARGS),-- $(ARGS))

check: lint test build api
