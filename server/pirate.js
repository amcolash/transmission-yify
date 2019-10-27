const axios = require('axios');
const cheerio = require('cheerio');
const workerpool = require('workerpool');
const ptn = require('../src/Util/TorrentName');

searchPirateBay = function(query, p, filter, endpoint) {
  const page = Number.parseInt(p);
  
  return new Promise((resolve, reject) => {
    const url = `${endpoint.replace(/\/$/, '')}/search/${query}/${page}${filter}`;
    
    axios.get(url).then(response => {
      const $ = cheerio.load(response.data);
      const torrents = [];

      const table = $('#searchResult tbody').html();
      const rows = $('tr', table);
      
      const sizeRegex = new RegExp(/(\d|\.)+\s(KiB|MiB|GiB)/);
      const fullDateRegex = new RegExp(/\d{2}-\d{2}\s*\d{4}/);
      const partialDateRegex = new RegExp(/\d{2}-\d{2}/);
      
      const results = $('h2').eq(0).text();
      
      const limit = 30;
      
      const found = results.match(/\d+\sfound/);
      let total = 0;

      if (found && found.length > 0) total = Number.parseInt(found[0].match(/\d+/)[0]);
      
      rows.each((i, row) => {
        // Try/Catch on each row so that an error parsing doesn't totally destroy results
        try {
          const name = $('.detName', row).text().trim();
          if (!name) return;
          
          const link = $('.detLink', row).attr('href');
          const magnetLink = $('[title="Download this torrent using magnet"]', row).attr('href');
          const sizeMatched = $('.detDesc', row).text().trim().match(sizeRegex);
          const seeds = Number.parseInt($('[align="right"]', row).eq(0).text());
          const leeches = Number.parseInt($('[align="right"]', row).eq(1).text());
          const category = $('.vertTh a', row).eq(0).text();
          const subCategory = $('.vertTh a', row).eq(1).text();
          const authorName = $('.detDesc a', row).text();
          const authorUrl = $('.detDesc a', row).attr('href');
          
          let date;
          let fullDateMatched = $('.detDesc', row).text().trim().match(fullDateRegex); // TODO: Fix whitespace
          let partialDateMatched = $('.detDesc', row).text().trim().match(partialDateRegex);
          if (fullDateMatched) date = fullDateMatched[0];
          else if (partialDateMatched) date = partialDateMatched += ' ' + new Date().getFullYear();
          
          torrents.push({
            name,
            link,
            magnetLink,
            size: sizeMatched ? sizeMatched[0] : undefined,
            date: date,
            seeds,
            leeches,
            category,
            subCategory,
            author: {
              name: authorName,
              url: authorUrl
            }
          });
        } catch (err) {
          console.error(err);
        }
      });
      
      resolve({page, total, limit, torrents});
    }).catch(err => {
      console.error(err);
      reject();
    });
  });
}

filterMovieResults = function(results) {
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

workerpool.worker({
  searchPirateBay: searchPirateBay
});

module.exports = { searchPirateBay, filterMovieResults };