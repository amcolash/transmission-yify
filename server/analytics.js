const fs = require('fs');
const geoip = require('geoip-lite');
const CronJob = require('cron').CronJob;
const getUuid = require('uuid-by-string');

const { ANALYTICS_FILE } = require('./global');

let analytics = {};

const analyticsType = {
  EXPRESS_BASE: 'express_base',
  MOVIES: 'movies',
  SHOWS: 'shows',
  ANIMES: 'animes',
  PIRATE: 'pirate',
  TRANSMISSION: 'transmission',
  SUBSCRIPTION: 'subscription',
  ADMIN: 'admin',
};

// Write updates to the analytics file every 5 minutes for perf reasons
new CronJob(
  '0 */5 * * * *',
  function () {
    writeAnalytics();
  },
  null,
  true,
  'America/Los_Angeles'
);

function setupAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) analytics = require(ANALYTICS_FILE);
  } catch (err) {
    if (fs.existsSync(ANALYTICS_FILE)) fs.copyFileSync(ANALYTICS_FILE + '_backup' + new Date().getTime());
    console.error(err);
  }

  writeAnalytics();
}

function analyticsMiddleware(req, res, next) {
  next();

  try {
    // Need to remove ipv6 for local addresses for some reason to get the geoip library to work properly
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress).replace('::ffff:', '');
    const clientId = getUuid(ip);
    const geo = geoip.lookup(ip);
    let location = ip === '::1' ? 'localhost' : 'Unknown';
    if (geo) {
      location = {
        city: geo.city,
        state: geo.region,
        country: geo.country,
        lat: geo.ll[0],
        lng: geo.ll[1],
      };
    }

    const query = req.query;
    const url = req.path;
    const data = {
      clientId,
      location,
      method: req.method,
      query: Object.values(query).length > 0 ? query : undefined,
    };

    // If we are heading through proxies, exit and do not record
    if (url.indexOf('/remote') !== -1) return;
    if (url.indexOf('/spectrum') !== -1) return;

    let type = analyticsType.EXPRESS_BASE;
    if (url.indexOf('movie') !== -1 || url.indexOf('omdb') !== -1 || query.movie) type = analyticsType.MOVIES;
    if (url.indexOf('show') !== -1 || url.indexOf('tv') !== -1 || url.indexOf('tmdb/seasons') !== -1 || url.indexOf('eztv') !== -1)
      type = analyticsType.SHOWS;
    if (url.indexOf('kitsu') !== -1 || url.indexOf('nyaa') !== -1 || url.indexOf('horribleSubs') !== -1) type = analyticsType.ANIMES;
    if (url.indexOf('pirate') !== -1 && !query.movie) type = analyticsType.PIRATE;
    if (url.indexOf('subscriptions') !== -1) type = analyticsType.SUBSCRIPTION;
    if (url.indexOf('torrents') !== -1) type = analyticsType.TRANSMISSION;
    if (url.indexOf('analytics') !== -1 || url.indexOf('upgrade') !== -1 || url.indexOf('cache') !== -1) type = analyticsType.ADMIN;

    recordEvent(data, type, url);
  } catch (e) {
    console.error(e);
  }
}

function recordEvent(data, type, subtype) {
  if (Object.values(analyticsType).indexOf(type) === -1) {
    console.error(`No registered analytics type: ${type}`);
    return;
  }

  // we can't JSONify an array that has keys, so only make an array if there is no subtype
  analytics[type] = analytics[type] || (subtype ? {} : []);

  if (!subtype) {
    analytics[type].push({ timestamp: new Date(), ...data });
  } else {
    analytics[type][subtype] = analytics[type][subtype] || [];
    analytics[type][subtype].push({ timestamp: new Date(), ...data });
  }
}

function writeAnalytics() {
  fs.writeFile(ANALYTICS_FILE, JSON.stringify(analytics), (err) => {
    if (err) console.error(err);
  });
}

function getAnalytics() {
  return analytics;
}

module.exports = { setupAnalytics, analyticsMiddleware, recordEvent, analyticsType, getAnalytics };
