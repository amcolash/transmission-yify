const { Parser, addDefaults } = require('parse-torrent-title');

const parser = new Parser();

// Add my parsers first
parser.addHandler('complete', /COMPLETE/i, { type: 'boolean' });
parser.addHandler('resolution', /1920x1080/i, { value: '1080p' });
parser.addHandler('source', /\bTS\b/, { value: 'telesync' });
parser.addHandler('season', /\[s([0-9]{1,3})\]/i, { type: 'integer' });
parser.addHandler('episode', /\[e([0-9]{1,3})\]/i, { type: 'integer' });
parser.addHandler('episode2', /-\s*([0-9]{1,3})/i, { type: 'integer' });

// Then add default parsers
addDefaults(parser);

// Finally clean up some edge cases at the end
parser.addHandler(({ title, result }) => {
  // Fix bogus years
  if (result.year === 1920 && title.indexOf('1920x1080') !== -1) delete result.year;

  // Fix bogus seasons
  if (
    (result.season === 80 && result.episode === 72 && title.indexOf('1280x720') !== -1) ||
    (result.season === 20 && result.episode === 10 && title.indexOf('1920x1080') !== -1)
  ) {
    delete result.season;
    delete result.episode;
  }

  // Move episode2 -> episode if main was not set
  if (result.episode2 && !result.episode) {
    result.episode = result.episode2;
    delete result.episode2;
  }

  if (result.source) {
    result.quality = result.source;
    delete result.source;
  }
});

module.exports = function(name) {
  // cleanup to remove + symbols and remove group from front
  const cleaned = name.replace(/\+/g, ' ').replace(/^\[([\w\d-]+)\]/, '');
  const parsed = parser.parse(cleaned);

  return parsed;
};
