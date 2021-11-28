const fs = require('fs');
const path = require('path');
const ptn = require('../src/Util/TorrentName');

const { DATA, SUBSCRIPTION_FILE, IS_DOCKER, transmission, axios, TV } = require('./global');
const { getCache } = require('./cache');
const { getEZTVShows, getEZTVDetails } = require('./eztv');
const { getTMDBUrl, searchShow } = require('./util');

function setupSubscriptions(currentStatus) {
  // Setup subscription file
  try {
    if (fs.existsSync(SUBSCRIPTION_FILE)) currentStatus.subscriptions = require(SUBSCRIPTION_FILE);
    else writeSubscriptions(currentStatus.subscriptions, SUBSCRIPTION_FILE);
  } catch (err) {
    console.error(err);
    if (fs.existsSync(SUBSCRIPTION_FILE)) fs.copyFileSync(SUBSCRIPTION_FILE + '_backup' + new Date().getTime());
    writeSubscriptions(currentStatus.subscriptions, SUBSCRIPTION_FILE);
  }
}

function findSubscription(id, subscriptions) {
  const matched = subscriptions.filter((s) => s.id === id);
  return matched.length === 1 ? matched[0] : undefined;
}

async function downloadSubscription(id, subscriptions, piratePool, pirateBay, onlyLast) {
  // Get the current subscription status
  const matched = findSubscription(id, subscriptions);
  let subscription = matched || {};

  // Always grab new data for the show
  const url = getTMDBUrl(id, 'tv');
  let data;
  if (getCache()[url]) {
    data = getCache()[url];
  } else {
    try {
      const res = await axios.get(url);
      data = res.data;
      getCache()[url] = data;
    } catch (err) {
      return; // bail, things went wrong getting data
    }
  }

  console.log(`Checking subscription for ${data.name}`);

  // handle things this way so that the data stored is upgraded on the fly, it modifies the existing object this way
  subscription.id = id;
  subscription.imdb = data.external_ids.imdb_id;
  subscription.title = data.name;
  subscription.year = new Date(data.first_air_date).getFullYear();
  subscription.poster_path = 'https://image.tmdb.org/t/p/w300_and_h450_bestv2' + data.poster_path;

  // Only update these if needed
  subscription.lastSeason = subscription.lastSeason || 0;
  subscription.lastEpisode = subscription.lastEpisode || 0;

  // Add a new entry if it does not exist
  if (!matched) subscriptions.push(subscription);

  // write to file so we keep retrying if things fail below, also keep modified fields
  writeSubscriptions(subscriptions);

  // find torrents for the show
  const matchedShow = searchShow(subscription.title, getEZTVShows());
  if (!matchedShow || !matchedShow.url) {
    console.error(`Could not find show ${JSON.stringify(matchedShow || {})}, ${JSON.stringify(subscription || {})}`);
    return;
  }

  // Get 5 pages of pb data (latest uploaded using '/3/0'), to augment eztv data (if new episodes/seasons are missing)
  const pirateSearches = [];
  const pirateData = [];
  for (let i = 1; i <= 5; i++) {
    const worker = piratePool.exec('searchPirateBay', [subscription.title, i, '/3/0', pirateBay]);

    worker
      .then((data) => {
        // Update PB data to include slightly different names to match EZTV torrents
        const augmented = data.torrents.map((t) => {
          return { ...t, filename: t.name, magnet: t.magnetLink };
        });
        pirateData.push(...augmented);
      })
      .catch((err) => console.error(err));

    pirateSearches.push(worker);
  }

  await Promise.all(pirateSearches)
    .then(() => console.log('All done with PB, got', pirateData.length, 'results'))
    .catch((err) => console.error(err));

  getEZTVDetails(matchedShow.url, subscription.title)
    .then((data) => {
      // Augment eztv data with pirate bay data
      const allData = [...data.torrents, ...pirateData];

      // Generate a list of all episodes from the query
      const { episodes, lastEpisode } = getEpisodes(subscription, allData, onlyLast);

      if (episodes.length > 0) console.log(`need to get ${episodes.length} new files for ${subscription.title}`);

      // Download each torrent
      episodes.forEach((e) => {
        console.log(`Downloading new subscribed file: ${e.filename}`);
        transmission.addUrl(e.magnet, { 'download-dir': IS_DOCKER ? TV : path.join(DATA, 'downloads') }, (err, data) => {
          if (err) console.error(err);
        });
      });

      if (!lastEpisode) console.error(`Error: Could not find last episode for ${subscription.title}`);
      else {
        // Update subscription database
        subscription.lastSeason = lastEpisode.season;
        subscription.lastEpisode = lastEpisode.episode;
        writeSubscriptions(subscriptions);
      }
    })
    .catch((err) => {
      console.error(err);
    });
}

function getEpisodes(subscription, torrents, onlyLast) {
  let episodes = [];

  torrents.forEach((t) => {
    const parsed = ptn(t.filename);
    const episode = t.episode || parsed.episode;
    const season = t.season || parsed.season;
    const resolution = Number.parseInt(parsed.resolution);
    if (!episode || !season || Number.isNaN(resolution) || resolution < 720 || resolution > 1080) return;

    t.episode = Number.parseInt(episode);
    t.season = Number.parseInt(season);

    episodes[season] = episodes[season] || [];

    if (!episodes[season][episode]) episodes[season][episode] = t;
    else {
      const existing = episodes[season][episode];
      const parsedExisting = ptn(existing.filename);

      if (t.seeds > existing.seeds && resolution >= Number.parseInt(parsedExisting.resolution)) {
        episodes[season][episode] = t;
      }
    }
  });

  // Filter out non-relevant episodes as needed
  const lastSeason = episodes[episodes.length - 1];
  let lastEpisode;
  if (lastSeason) lastEpisode = lastSeason[lastSeason.length - 1];
  if (onlyLast) {
    episodes = [lastEpisode];
  } else {
    const lastValue = subscription.lastSeason * 99 + subscription.lastEpisode;

    const tmp = [];
    episodes = episodes.forEach((season) => {
      if (season) {
        season.forEach((episode) => {
          if (episode.season * 99 + episode.episode > lastValue) tmp.push(episode);
        });
      }
    });
    episodes = tmp;
  }

  return { episodes, lastEpisode };
}

function writeSubscriptions(subscriptions) {
  fs.writeFile(SUBSCRIPTION_FILE, JSON.stringify(subscriptions), (err) => {
    if (err) console.error(err);
  });
}

module.exports = { setupSubscriptions, findSubscription, downloadSubscription, writeSubscriptions };
