const levenshtein = require('js-levenshtein');
const ptn = require('../src/Util/TorrentName');

function autoPrune(currentTorrents, transmission) {
  // Max wait time after complete is 3 days
  const maxWait = 60 * 60 * 24 * 3;
  
  if (currentTorrents && currentTorrents.torrents) {
    currentTorrents.torrents.forEach(torrent => {
      let uploadComplete = torrent.uploadRatio > 3.0;
      let expired = (Date.now() / 1000) > (torrent.doneDate + maxWait);
      
      if (torrent.percentDone === 1.0 && (uploadComplete || (expired && torrent.doneDate > 0))) {
        // Soft remove (keep data but stop uploading)
        console.log('removing complete torrent: ' + torrent.name + (uploadComplete ? ', upload complete' : '') + (expired ? ', expired' : ''));
        
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
  torrents.forEach(t => {
      const parsed = ptn(t.name);
      if (parsed.quality && parsed.resolution) hasNonCam |= parsed.quality.toLowerCase().indexOf('cam') === -1 &&
        parsed.quality.toLowerCase().indexOf('telesync') === -1;
  });

  
  const versions = [];
  
  torrents.forEach(t => {
      const parsed = ptn(t.name);
      if (!parsed.quality || !parsed.resolution) return;
      
      const isCam = parsed.quality.toLowerCase().indexOf('cam') !== -1 || parsed.quality.toLowerCase().indexOf('telesync') !== -1;

      // Not going to show 2160p or 4k since they are UUUUGE
      const parsedResolution = Number.parseInt(parsed.resolution);
      const shouldAdd = !(parsedResolution < 480 || parsedResolution > 1080 || (hasNonCam && isCam));
      
      if (shouldAdd) {
        if (versions[parsed.resolution] && versions[parsed.resolution].seeds > t.seeds) return;
        
        versions[parsed.resolution] = t;
      }
  });
  
  const filtered = Object.values(versions);

  return {page: results.page, total: filtered.length, limit: filtered.length, torrents: filtered};
}

// TODO: Move to a subscription util file later...
function getEpisodes(subscription, torrents, onlyLast) {
  let episodes = [];

  torrents.forEach(t => {
    const parsed = ptn(t.filename);
    const episode = t.episode || parsed.episode;
    const season = t.season || parsed.season;
    if (!episode || !season) return;
    
    t.episode = Number.parseInt(episode);
    t.season = Number.parseInt(season);
    
    episodes[season] = episodes[season] || [];
    
    if (!episodes[season][episode]) episodes[season][episode] = t;
    else {
      const existing = episodes[season][episode];
      const parsedExisting = ptn(existing.filename);
      
      if (t.seeds > existing.seeds || Number.parseInt(parsed.resolution) > Number.parseInt(parsedExisting.resolution)) {
        episodes[season][episode] = t;
      }
    }
  });
  
  // Filter out non-relevant episodes as needed
  const lastSeason = episodes[episodes.length-1];
  const lastEpisode = lastSeason[lastSeason.length-1];
  if (onlyLast) {
    episodes = [lastEpisode];
  } else {
    const lastValue = subscription.lastSeason * 99 + subscription.lastEpisode;
    
    const tmp = [];
    episodes = episodes.forEach(season => {
      if (season) {
        season.forEach(episode => {
          if (episode.season * 99 + episode.episode > lastValue) tmp.push(episode);
        });
      }
    });
    episodes = tmp;
  }

  return { episodes, lastEpisode };
}

function searchShow(search, source) {
  let matched;
  source.forEach(s => {
    const lev = levenshtein(s.title.toLowerCase(), search.toLowerCase());
    const match = (1 - (lev / Math.max(s.title.length, search.length)));
    if (match > 0.9) matched = s;
  });
  
  return matched;
}

module.exports = { autoPrune, filterMovieResults, getEpisodes, searchShow };