const cheerio = require('cheerio');
const ptn = require('../src/Util/TorrentName');
const { axios } = require('./global');

let eztvShows = [];

function getEZTVDetails(url, title) {
  return new Promise((resolve, reject) => {
    axios
      .get(url)
      .then((response) => {
        const torrents = [];

        const $ = cheerio.load(response.data);
        const table = $('.forum_header_noborder');
        const items = $('tr[name="hover"]', table);
        items.each((index, el) => {
          const columns = $('td', el);
          const filename = $('a', columns.eq(1)).text();
          const link = $('a', columns.eq(1)).attr('href');
          const magnet = $('a', columns.eq(2)).attr('href');
          const size = columns.eq(3).text();
          const date = columns.eq(4).text();
          const seeds = Number.parseInt(columns.eq(5).text()) || 0;

          const parsed = ptn(filename);
          const episode = parsed.episode ? Number.parseInt(parsed.episode) : undefined;
          const season = parsed.season ? Number.parseInt(parsed.season) : undefined;
          const parsedResolution = Number.parseInt(parsed.resolution);
          if (!episode || !season || parsedResolution > 1080) return;

          // Odd exception for 'Breaking Bad' - there is a show called 'Breaking Brad' which interferes :(
          if (title && parsed.title) {
            if (title.toLowerCase() === 'breaking bad' && parsed.title.toLowerCase() === 'breaking brad') return;
          }

          const torrent = {
            filename,
            link,
            magnet,
            size,
            date,
            seeds,
            episode,
            season,
          };

          torrents.push(torrent);
        });

        resolve({ page: 1, total: torrents.length, limit: torrents.length, torrents, url, title });
      })
      .catch((err) => {
        resolve({ page: 1, total: 0, limit: 30, torrents: [], url, title });
      });
  });
}

function updateEZTVShows(endpoint) {
  axios
    .get(`${endpoint}/showlist/`)
    .then((response) => {
      const $ = cheerio.load(response.data);

      const table = $('.forum_header_border').eq(1);
      const items = $('tr[name="hover"] td:first-child', table);

      const shows = [];

      items.each((index, el) => {
        const row = $('a', el);
        let title = row.text();
        if (title.endsWith(', The')) title = `The ${title.replace(', The', '')}`;
        title = title.replace(/\s*\(\d{4}\)/g, '');
        const url = `${endpoint}/${row.attr('href').substring(1)}`;
        shows.push({
          title,
          url,
        });
      });

      eztvShows = shows;
    })
    .catch((err) => {});
}

function getEZTVShows() {
  return eztvShows;
}

module.exports = { getEZTVDetails, getEZTVShows, updateEZTVShows };
