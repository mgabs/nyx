import config from './jest.config.mjs';
config.globals.product = 'firefox';
config.globals.__CHROMIUM_MV2__ = false;
config.globals.__CHROMIUM_MV3__ = false;
config.globals.__FIREFOX_MV2__ = false;
config.globals.__FIREFOX_MV3__ = true;
export default config;
