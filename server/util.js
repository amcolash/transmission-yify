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

// TODO: Change callback into a promise
function getFiles(plexClient, cb) {
  if (!plexClient) cb([]);
  
  plexClient.query('/').then(status => {
    const machineId = status.MediaContainer.machineIdentifier;
    
    plexClient.query("/library/sections").then(response => {
      const sections = response.MediaContainer.Directory.filter(section => { return section.type === "movie" });
      const promises = [];
      
      for (var i = 0; i < sections.length; i++) {
        promises.push(plexClient.query("/library/sections/" + sections[i].key + "/all"));
      }
      
      Promise.all(promises).then(values => {
        const files = [];
        for (var i = 0; i < values.length; i++) {
          const data = values[i].MediaContainer.Metadata;
          for (var j = 0; j < data.length; j++) {
            const url = `http://${process.env.PLEX_HOSTNAME}:32400/web/index.html#!/server/${machineId}/details?key=${data[j].key}`;
            files.push({title: data[j].title, year: data[j].year, url: url});
          }
        }
        cb(files);
      });
    }).catch(err => {
      console.error("Could not connect to server", err);
      
      // If plex goes offline, keep in-memory copy living on
      if (currentFiles.length > 0) {
        cb(currentFiles);
      } else {
        cb([]);
      }
    });
  }).catch(err => {
    console.error(err);
    cb([]);
  });
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

module.exports = { autoPrune, getEpisodes, getFiles, searchShow };