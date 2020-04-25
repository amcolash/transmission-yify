const levenshtein = require('js-levenshtein');
const ptn = require('../src/Util/TorrentName');

function autoPrune(currentTorrents, transmission) {
  // Max wait time after complete is 3 days
  const maxWait = 60 * 60 * 24 * 3;

  if (currentTorrents && currentTorrents.torrents) {
    currentTorrents.torrents.forEach((torrent) => {
      let uploadComplete = torrent.uploadRatio > 3.0;
      let expired = Date.now() / 1000 > torrent.doneDate + maxWait;

      if (torrent.percentDone === 1.0 && (uploadComplete || (expired && torrent.doneDate > 0))) {
        // Soft remove (keep data but stop uploading)
        console.log(
          'removing complete torrent: ' + torrent.name + (uploadComplete ? ', upload complete' : '') + (expired ? ', expired' : '')
        );

        transmission.remove(torrent.hashString, false, (err) => {
          if (err) console.error(err);
        });
      }

      // Auto resume paused torrents (not sure why things are getting paused)
      if (!torrent.isFinished && torrent.status === transmission.status.STOPPED) {
        console.log(`trying to restart paused torrent: ${torrent.name}`);
        transmission.start(torrent.hashString, (err, arg) => {
          if (err) console.error(err);
        });
      }
    });
  }
}

function filterMovieResults(results) {
  const torrents = results.torrents;

  // Only show cams if there are not other versions
  let hasNonCam = false;
  torrents.forEach((t) => {
    const parsed = ptn(t.name);
    if (parsed.quality && parsed.resolution)
      hasNonCam |= parsed.quality.toLowerCase().indexOf('cam') === -1 && parsed.quality.toLowerCase().indexOf('telesync') === -1;
  });

  const versions = [];

  torrents.forEach((t) => {
    const parsed = ptn(t.name);
    if (!parsed.quality || !parsed.resolution) return;

    const isCam = parsed.quality.toLowerCase().indexOf('cam') !== -1 || parsed.quality.toLowerCase().indexOf('telesync') !== -1;

    // Not going to show 2160p or 4k since they are UUUUGE
    const parsedResolution = Number.parseInt(parsed.resolution);
    let shouldAdd = !(parsedResolution < 480 || parsedResolution > 1080 || (hasNonCam && isCam));

    // Filter out movies larger than 4gb
    if (t.size) {
      const mb = t.size.toLowerCase().indexOf('mib') !== -1;
      const size = Number.parseFloat(t.size) * (mb ? 1 : 1000);
      if (size > 4000) shouldAdd = false;
    }

    if (shouldAdd) {
      if (versions[parsed.resolution] && versions[parsed.resolution].seeds > t.seeds) return;

      versions[parsed.resolution] = t;
    }
  });

  const filtered = Object.values(versions);

  return { page: results.page, total: filtered.length, limit: filtered.length, torrents: filtered };
}

function filterPBShows(results) {
  // Only return non-eztv torrents which are alive and have enough info
  return results.torrents.filter((t) => t.seeds > 0 && t.name.indexOf('eztv') === -1);
}

function JSONStringify(object) {
  var cache = [];
  var str = JSON.stringify(
    object,
    // custom replacer fxn - gets around "TypeError: Converting circular structure to JSON"
    function (key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          // Circular reference found, discard key
          return;
        }
        // Store value in our collection
        cache.push(value);
      }
      return value;
    },
    4
  );
  cache = null; // enable garbage collection
  return str;
}

function searchShow(search, source) {
  let matched;
  source.forEach((s) => {
    const lev = levenshtein(s.title.toLowerCase(), search.toLowerCase());
    const match = 1 - lev / Math.max(s.title.length, search.length);
    if (match > 0.9) matched = s;
  });

  return matched;
}

function getTMDBUrl(id, type) {
  return (
    'https://api.themoviedb.org/3/' +
    type +
    '/' +
    id +
    '?api_key=' +
    process.env.THE_MOVIE_DB_KEY +
    '&append_to_response=external_ids,videos,recommendations' +
    (type === 'tv' ? ',content_ratings' : '')
  );
}

function setIntervalImmediately(func, interval) {
  func();
  return setInterval(func, interval);
}

module.exports = { autoPrune, filterPBShows, filterMovieResults, JSONStringify, searchShow, getTMDBUrl, setIntervalImmediately };
