const cheerio = require('cheerio');
const workerpool = require('workerpool');
const { axios } = require('./global');

getTorrentsV1 = function ($) {
  const table = $('#searchResult tbody').html();
  const rows = $('tr', table);

  const sizeRegex = new RegExp(/(\d|\.)+\s(KiB|MiB|GiB)/);
  const fullDateRegex = new RegExp(/\d{2}-\d{2}\s*\d{4}/);
  const partialDateRegex = new RegExp(/\d{2}-\d{2}/);

  const torrents = [];
  rows.each((i, row) => {
    // Try/Catch on each row so that an error parsing doesn't totally destroy results
    try {
      const name = $('.detName', row).text().trim();
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
          url: authorUrl,
        },
      });
    } catch (err) {
      console.error(err);
    }
  });

  return torrents;
};

// Looks like some offshoot mirrors have a different layout, secondary parsing for these
getTorrentsV2 = function ($, endpoint) {
  const timeRegex = new RegExp(/\d{2}:\d{2}/);
  const categoryRegex = new RegExp(/.*(?= >)/);
  const subCategoryRegex = new RegExp(/(> )(.*)/);

  const headerPrettyNames = {
    'name view: single / double': 'name',
    '': 'magnet',
    se: 'seeds',
    le: 'leeches',
    'uled by': 'author',
  };

  const torrents = [];

  // Parsing based off of: https://stackoverflow.com/a/49219887/2303432
  const scrapedData = [];
  const tableHeaders = [];
  $('#searchResult tr').each((index, element) => {
    if (index === 0) {
      const ths = $(element).find('th');
      $(ths).each((i, element) => {
        let name = $(element).text().toLowerCase().trim();
        if (headerPrettyNames[name]) name = headerPrettyNames[name];
        tableHeaders.push(name);
      });
      return true;
    }
    const tds = $(element).find('td');

    if (tds.length > 1) {
      const tableRow = {};
      $(tds).each((i, element) => {
        tableRow[tableHeaders[i]] = $(element).text();
        const link = $(element).find('a');
        if (link.length > 0) tableRow[tableHeaders[i] + '_link'] = link.attr('href');
      });
      scrapedData.push(tableRow);
    }
  });

  scrapedData.map((data) => {
    try {
      let date = data.uploaded;
      const timeMatched = date.match(timeRegex);
      if (timeMatched) date = date.replace(timeMatched[0], new Date().getFullYear());

      const category = data.type.match(categoryRegex)[0];
      const subCategory = data.type.match(subCategoryRegex)[2];

      torrents.push({
        name: data.name,
        link: data.name_link,
        magnetLink: data.magnet_link,
        size: data.size,
        date,
        seeds: Number.parseInt(data.seeds),
        leeches: Number.parseInt(data.leeches),
        category,
        subCategory,
        author: {
          name: data.author,
          url: endpoint + data.author_link,
        },
      });
    } catch (e) {
      console.error(e);
    }
  });

  return torrents;
};

searchPirateBay = function (query, p, filter, endpoint) {
  const page = Number.parseInt(p);

  return new Promise((resolve, reject) => {
    const url = `${endpoint.replace(/\/$/, '')}/search/${query}/${page}${filter}`;

    axios
      .get(url)
      .then((response) => {
        const $ = cheerio.load(response.data);

        const results = $('h2').eq(0).text();
        const limit = 30;
        const found = results.match(/\d+\sfound/);
        let total = 0;

        if (found && found.length > 0) total = Number.parseInt(found[0].match(/\d+/)[0]);

        let torrents;
        if ($('.detName').length > 0) {
          torrents = getTorrentsV1($);
        } else {
          torrents = getTorrentsV2($, endpoint);
        }

        resolve({ page, total, limit, torrents });
      })
      .catch((err) => {
        reject();
      });
  });
};

workerpool.worker({
  searchPirateBay: searchPirateBay,
});
