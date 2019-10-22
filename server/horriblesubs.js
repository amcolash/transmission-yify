const axios = require('axios');
const cheerio = require('cheerio');

let horribleSubsShows = [];

function updateHorribleSubsShows() {
  axios.get('https://horriblesubs.info/shows/').then(response => {
  const $ = cheerio.load(response.data);
  
  const wrapper = $('.shows-wrapper').eq(0);
  const items = $('.ind-show', wrapper);
  
  const shows = [];
  
  items.each((index, el) => {
    const row = $('a', el);
    let title = row.text();
    shows.push({
      title,
      url: 'https://horriblesubs.info/shows' + row.attr('href')
    });
  });
  
  horribleSubsShows = shows;
}).catch(err => {
  console.error(err);
});
}

function parseHorribleSubsVersion(data, url) {
  const $ = cheerio.load(data);
  const containers = $('.rls-info-container');
  
  const torrents = [];
  
  containers.each((index, container) => {
    const label = $('.rls-label', container).text();
    const date = $('.rls-date', container).text();
    const episode = $('strong', container).text().replace('-', ' - ');
    
    const links = $('.rls-link', container);
    const versions = [];
    links.each((index, el) => {
      const quality = $('.rls-link-label', el).text().trim().replace(/:/g, '');
      const magnet = $('.hs-magnet-link a', el).attr('href');
      
      versions.push({
        filename: label,
        quality,
        magnet,
        date,
        link: url,
        episode
      });
    });
    
    torrents.push(versions);
  });
  
  return torrents;
}

function queueHorribleSubs(showId, page, torrents, outerResolve) {
  let promise;
  if (!outerResolve) {
    promise = new Promise((resolve, reject) => {
      outerResolve = resolve;
    });
  }
  
  let url = 'https://horriblesubs.info/api.php?method=getshows&type=show&showid=' + showId;
  if (page > 1) url += ('&nextid=' + (page - 1));
  
  axios.get(url).then(response => {
    if (response.data !== 'DONE') {
      const parsed = parseHorribleSubsVersion(response.data, url);
      parsed.forEach(t => torrents.push(...t));
      queueHorribleSubs(showId, page + 1, torrents, outerResolve);
    } else {
      outerResolve();
    }
  }).catch(err => {
    console.error(err);
  });
  
  return promise;
}

function getHorribleSubsDetails(url) {
  return new Promise((resolve, reject) => {
    axios.get(url).then(response => {
      const match = response.data.match(/var hs_showid = \d+;/g);
      if (match.length  === 1) {
        const showId = Number.parseInt(match[0].match(/\d+/g)[0]);
        
        const promises = [];
        const batches = [];
        const torrents = [];
        
        // Get batches
        promises.push(axios.get('https://horriblesubs.info/api.php?method=getshows&type=batch&showid=' + showId).then(response => {
        if (response.data !== 'The are no batches for this show yet') {
          const parsed = parseHorribleSubsVersion(response.data, url);
          if (parsed.length === 1) batches.push(...parsed[0]);
        }
      }).catch(err => {
        console.error(err);
      }));
      
      // Start queueing up individual episodes
      promises.push(queueHorribleSubs(showId, 1, torrents));
      
      // I guess this works but it feels like it could be very brittle, need to check on this longer term...
      axios.all(promises).then(() => {
        const total = torrents.length + batches.length;
        resolve({page: 1, total, limit: total, torrents, batches});
      });
    } else {
      resolve({page: 1, total: 0, limit: 30, torrents: [], batches: []});
    }
  }).catch(err => {
    console.error(err);
    resolve({page: 1, total: 0, limit: 30, torrents: [], batches: []});
  });
});
}

function getHorribleSubsShows() {
  return horribleSubsShows;
}

module.exports = { getHorribleSubsDetails, getHorribleSubsShows, updateHorribleSubsShows };