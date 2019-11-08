const fs = require('fs');
const transmissionWrapper = require('transmission');

const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = IS_DOCKER ? 9090 : 9000;
const DATA = (IS_DOCKER ? '/data' : process.env.DATA_DIR);
const CACHE_FILE = DATA + '/cache.json';
const SUBSCRIPTION_FILE = DATA + '/subscriptions.json';
const ANALYTICS_FILE = DATA + '/analytics.json';
const interval = 2000;

// Transmission wrapper, conditional host based on if running from a docker container
const transmission = new transmissionWrapper({ host: IS_DOCKER ? 'transmission' : '127.0.0.1',
    username: process.env.TRUSER, password: process.env.TRPASSWD });

module.exports = { IS_DOCKER, PORT, DATA, CACHE_FILE, SUBSCRIPTION_FILE, ANALYTICS_FILE, interval, transmission };