.PHONY: help build api debug lint test test-unit test-inject test-browser test-chrome test-chrome-mv3 test-firefox test-all check bench

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
	@echo "Targets: build api debug lint test test-unit test-inject test-browser test-chrome test-chrome-mv3 test-firefox test-all check"

build:
	npm run build

api:
	npm run api

debug:
	npm run debug

lint:
	npm run lint

test:
	npm test

test-unit:
	npm run test:unit

test-inject:
	npm run test:inject

test-browser:
	npm run test:browser

test-chrome:
	npm run test:chrome

test-chrome-mv3:
	npm run test:chrome-mv3

test-firefox:
	npm run test:firefox

test-all:
	npm run test:all

bench:
	npm run bench -- $(ARGS)

check: lint test build api
