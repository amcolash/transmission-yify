const PlexAPI = require('plex-api');

require('dotenv').config();

// Init plex client
let plexClient;
try {
  plexClient = new PlexAPI({
    hostname: process.env.PLEX_HOSTNAME, // could be different than plex link
    username: process.env.PLEX_USERNAME,
    password: process.env.PLEX_PASSWORD,
    options: {
      identifier: 'transmission-yify',
      deviceName: 'Transmission-Yify',
    },
  });
} catch (error) {
  console.error(error);
}

function getPlexFiles(currentFiles) {
  return new Promise((resolve, reject) => {
    if (!plexClient || !plexClient.query) resolve([]);

    plexClient
      .query('/')
      .then((status) => {
        const machineId = status.MediaContainer.machineIdentifier;

        plexClient
          .query('/library/sections')
          .then((response) => {
            const sections = response.MediaContainer.Directory.filter((section) => {
              return section.type === 'movie';
            });
            const promises = [];

            for (var i = 0; i < sections.length; i++) {
              promises.push(plexClient.query('/library/sections/' + sections[i].key + '/all'));
            }

            Promise.all(promises).then((values) => {
              const files = [];
              for (var i = 0; i < values.length; i++) {
                const data = values[i].MediaContainer.Metadata;
                for (var j = 0; j < data.length; j++) {
                  const url = `http://${process.env.PLEX_HOSTNAME}:32400/web/index.html#!/server/${machineId}/details?key=${data[j].key}`;
                  files.push({ title: data[j].title, year: data[j].year, url: url });
                }
              }
              resolve(files.sort((a, b) => a.title.localeCompare(b.title)));
            });
          })
          .catch((err) => {
            console.error('Could not connect to server', err);

            // If plex goes offline, keep in-memory copy living on
            if (currentFiles.length > 0) {
              resolve(currentFiles);
            } else {
              resolve([]);
            }
          });
      })
      .catch((err) => {
        console.error(err);
        resolve([]);
      });
  });
}

module.exports = { getPlexFiles };
