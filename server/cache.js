const fs = require('fs');
const axios = require('axios');
const CronJob = require('cron').CronJob;

const { CACHE_FILE, IS_DOCKER } = require('./global');
const { searchShow } = require('./util');
const { getEZTVShows } = require('./eztv');

let cache = {};
let trackerCache = {};

// Auto clean torrent cache every 12 hours
new CronJob(
  '00 00 */12 * * *',
  function() {
    console.log('scheduled clearing of tracker cache');
    trackerCache = {};
  },
  null,
  true,
  'America/Los_Angeles'
);

// Wipe the full cache weekly at 4am on sunday/wednesday morning
new CronJob(
  '00 00 4 * * 0,3',
  function() {
    console.log('scheduled clearing of main cache');
    clearCache();
  },
  null,
  true,
  'America/Los_Angeles'
);

// Write updates to the cache every 5 minutes for perf reasons
new CronJob(
  '0 */5 * * * *',
  function() {
    writeCache();
  },
  null,
  true,
  'America/Los_Angeles'
);

function setupCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) cache = require(CACHE_FILE);
    else writeCache();
  } catch (err) {
    console.error(err);
    writeCache();
  }

  // Clear cache on boot in dev environment
  if (process.env.NODE_ENV === 'development') {
    cache = {};
    trackerCache = {};
  }
}

function clearCache() {
  cache = {};
  trackerCache = {};
  writeCache();
}

function writeCache() {
  fs.writeFile(CACHE_FILE, JSON.stringify(cache), err => {
    if (err) console.error(err);
  });
}

function filterTV(url, data) {
  if (url.indexOf('https://api.themoviedb.org') !== -1 && url.indexOf('tv') !== -1) {
    if (data.results) {
      data.results = data.results.filter(show => {
        return searchShow(show.original_name, getEZTVShows()) !== undefined;
      });
    }
    if (data.recommendations && data.recommendations.results) {
      data.recommendations.results = data.recommendations.results.filter(show => {
        return searchShow(show.original_name, getEZTVShows()) !== undefined;
      });
    }
  }

  return data;
}

// Stick things into a cache
function cacheRequest(url, res, shouldRetry) {
  axios
    .get(url, { timeout: 10000 })
    .then(response => {
      const data = filterTV(url, response.data);

      // cache for 1 day
      if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=86400');
      res.send(data);
      cache[url] = data;
    })
    .catch(error => {
      if (shouldRetry) {
        setTimeout(() => cacheRequest(url, res, false), 10000);
      } else {
        console.error(error);
        res.send(error);
      }
    });
}

// Check if the cache has data, else grab it
function checkCache(url, res, shouldRetry) {
  if (cache[url]) {
    // cache for 1 day
    if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=86400');
    res.send(cache[url]);
  } else {
    cacheRequest(url, res, shouldRetry);
  }
}

function checkTrackerCache(url, res) {
  if (trackerCache[url]) {
    if (res) {
      // cache for 6 hours
      if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
      res.send(trackerCache[url]);
    }
  } else {
    axios
      .get(url)
      .then(response => {
        if (res) {
          // cache for 6 hours
          if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
          res.send(response.data);
        }
        trackerCache[url] = response.data;
      })
      .catch(err => {
        console.error(err);
        if (res) res.send([]);
      });
  }
}

function getCache() {
  return cache;
}

function getTrackerCache() {
  return trackerCache;
}

module.exports = { getCache, getTrackerCache, setupCache, clearCache, checkCache, checkTrackerCache };
