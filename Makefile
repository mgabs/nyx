.PHONY: all install build build-release clean lint lint-bundle test test-unit test-inject test-chrome test-chrome-mv3 test-firefox test-browser test-dependencies

all: lint test

install:
	npm ci

build:
	node tasks/cli.js build

build-release:
	node tasks/cli.js build --release

clean:
	rm -rf build

lint:
	npm run lint

lint-bundle:
	npm run lint:bundle

test: test-unit

test-unit:
	npm run test:unit -- $(ARGS)

test-inject:
	npm run test:inject -- $(ARGS)

test-chrome:
	npm run test:chrome -- $(ARGS)

test-chrome-mv3:
	npm run test:chrome-mv3 -- $(ARGS)

test-firefox:
	npm run test:firefox -- $(ARGS)

test-browser:
	npm run test:browser

test-dependencies:
	node tests/dependencies.js
