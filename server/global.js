const fs = require('fs');
const transmissionWrapper = require('transmission');
const axiosMain = require('axios');
const AxiosLogger = require('axios-logger');

require('dotenv').config();

const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = 9090;
const DATA = IS_DOCKER ? '/data' : process.env.DATA_DIR;
const TV = IS_DOCKER ? '/TV' : process.env.DATA_DIR;
const CACHE_FILE = DATA + '/cache.json';
const SUBSCRIPTION_FILE = DATA + '/subscriptions.json';
const ANALYTICS_FILE = DATA + '/analytics.json';
const interval = 2000;

const axios = axiosMain.create();
axios.interceptors.request.use((request) => {
  return AxiosLogger.requestLogger(request, {
    dateFormat: 'h:MM:ss TT mm/dd/yyyy',
    headers: true,
  });
});

// Transmission wrapper, conditional host based on if running from a docker container
const transmission = new transmissionWrapper({
  host: IS_DOCKER ? 'transmission' : '127.0.0.1',
  username: process.env.TRUSER,
  password: process.env.TRPASSWD,
});

module.exports = { IS_DOCKER, PORT, DATA, TV, CACHE_FILE, SUBSCRIPTION_FILE, ANALYTICS_FILE, interval, transmission, axios };
