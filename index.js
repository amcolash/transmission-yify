'use strict';

const axios = require('axios');
const cors = require('cors');
const { exec } = require('child_process');
const express = require('express');
const proxy = require('express-http-proxy');
const redirectToHTTPS = require('express-http-to-https').redirectToHTTPS;
const fs = require('fs');
const cheerio = require('cheerio');
const transmissionWrapper = require('transmission');
const querystring = require('querystring');
const CronJob = require('cron').CronJob;

require('dotenv').config();

const PlexAPI = require("plex-api");

let plexClient;
try {
    plexClient = new PlexAPI({
        hostname: process.env.PLEX_HOSTNAME, // could be different than plex link
        username: process.env.PLEX_USERNAME,
        password: process.env.PLEX_PASSWORD,
        options: {
            identifier: "transmission-yify",
            deviceName: "Transmission-Yify"
        }
    });
} catch (error) {
    console.error(error);
}

// Init vars
const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = 9000;
const DATA = (IS_DOCKER ? '/data' : process.env.DATA_DIR);
const CACHE_FILE = DATA + '/cache.json';

let BUILD_TIME = 'Dev Build';
if (fs.existsSync('./build_time') && IS_DOCKER) {
    try {
        BUILD_TIME = new Date(fs.readFileSync('./build_time'));
    } catch (err) {
        console.error(err);
    }
}

var currentTorrents = [];
var currentStorage;
var currentFiles = [];

var cache = {};
var trackerCache = {};
var isUpgrading = false;

var pirateBay;

// App Server
const app = express();
app.use(express.json());
app.use(cors());
app.use(redirectToHTTPS());

// proxy remote commands through
app.use('/remote', proxy(process.env.REMOTEBOOT_IP));

// HTTPS setup
const credentials = {};
credentials.key = fs.readFileSync('./.cert/privkey.pem');

// Try to fix let's encrypt stuff based on this post
// https://community.letsencrypt.org/t/facebook-dev-error-curl-error-60-ssl-cacert/72782
if (fs.existsSync('./.cert/fullchain.pem')) {
    credentials.cert = fs.readFileSync('./.cert/fullchain.pem');
} else if (fs.existsSync('./.cert/cert.pem')) {
    credentials.cert = fs.readFileSync('./.cert/cert.pem');
}

// Auto clean tracker cache daily at 5am
new CronJob('00 00 05 * * *', function() {
    console.log('scheduled clearing of tracker cache');
    this.trackerCache = {};
}, null, true, 'America/Los_Angeles');

// Make the server
const server = require('https').createServer(credentials, app);
const io = require('socket.io')(server);

// Transmission wrapper, conditional host based on if running from a docker container
const transmission = new transmissionWrapper({ host: IS_DOCKER ? 'transmission' : '127.0.0.1',
    username: process.env.TRUSER, password: process.env.TRPASSWD });

// Get this party started!
try {
    // Set up data dir if not in docker environment
    if (!IS_DOCKER && !fs.existsSync(DATA)) {
        fs.mkdirSync(DATA, { recursive: true }, (err) => {
            if (err) console.error(err);
        });
    }

    // Setup cache
    try {
        fs.accessSync(CACHE_FILE, (err) => {
            cache = require(CACHE_FILE);
        });
    } catch (err) {
        writeCache();
    }

    server.listen(PORT);
    console.log(`Running on port ${PORT}`);
    if (typeof(BUILD_TIME) !== 'string') console.log(`Docker image build time ${BUILD_TIME}`);

    // Autoprune on start
    autoPrune();

    // Init socket watchers
    initSocketDataWatchers();
} catch (err) {
    console.error(err);
}

// Set up static content
app.use('/', express.static('build'));

app.get('/ip', function (req, res) {
    try {
        if (IS_DOCKER) {
            let ip = fs.readFileSync(DATA + '/ip.txt', 'utf8');
            handleIP(ip, res);
        } else {
            handleIP(null, res);
        }
    } catch(err) {
        console.error(err);
        res.send('unknown');
    }
});

function handleIP(ip, res) {
    axios.get('https://api.ipdata.co/' + (ip ? ip.trim() : '') + '?api-key=' + process.env.IP_KEY).then(response => {
        res.send(response.data);
    }, error => {
        console.error(error);
        res.send(ip);
    });
}

app.get('/storage', function (req, res) { getStorage(data => res.send(data)); });

function getStorage(cb) {
    exec('df ' + DATA + " | grep -v 'Use%' | awk '{ print $5 }'", function (err, output) {
        if (err) {
            console.error(err);
            cb('unknown');
        } else {
            try {
                const stats = fs.statSync(CACHE_FILE);
                const fileSizeInBytes = stats["size"];
                const fileSizeInMegabytes = (fileSizeInBytes / Math.pow(1024, 2)).toFixed(1);
                cb({ used: output.replace('%', '').trim(), cache: `${fileSizeInMegabytes} MB` });
            } catch (err) {
                cb({ used: output.replace('%', '').trim() });
            }
        }
    });
}

function getFiles(cb) {
    if (!plexClient) cb([]);

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
                    files.push({title: data[j].title, year: data[j].year});
                }
            }
            cb(files);
        });
    }, function (err) {
        console.error("Could not connect to server", err);

        // If plex goes offline, keep in-memory copy living on
        if (currentFiles.length > 0) {
            cb(currentFiles);
        } else {
            cb([]);
        }
    });
}

app.get('/omdb/:id', function(req, res) {
    let url ='https://www.omdbapi.com/?apikey=' + process.env.OMDB_KEY + '&i=' + req.params.id;
    checkCache(url, res, true);
});

app.get('/tmdbid/:type/:id', function(req, res) {
    let url = 'https://api.themoviedb.org/3/' + req.params.type + '/' + req.params.id + '?api_key=' + process.env.THE_MOVIE_DB_KEY + 
        '&append_to_response=external_ids';
    checkCache(url, res, true);    
});

app.get('/themoviedb/:id', function (req, res) {
    let url = 'https://api.themoviedb.org/3/find/' + req.params.id + '?external_source=imdb_id&api_key=' + process.env.THE_MOVIE_DB_KEY;
    checkCache(url, res, true);
});

app.get('/kitsu/:id', function (req, res) {
    let url = `https://kitsu.io/api/edge/anime/${req.params.id}?include=genres`;
    checkCache(url, res, true);
});

app.get('/search/:type/:page', function (req, res) {
    let url;
    switch(req.params.type) {
        case 'movies':
            url = 'https://api.themoviedb.org/3/search/movie/?' + querystring.stringify(req.query) + '&page=' + req.params.page +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
            break;
        case 'shows':
            url = 'https://api.themoviedb.org/3/search/tv/?' + querystring.stringify(req.query) + '&page=' + req.params.page +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
            break;
        default:
            break;
    }
    if (!url) res.send([]);

    axios.get(url).then(response => res.send(response.data)).catch(err => { console.error(err); res.send([]); });
});

app.get('/discover/:type/:page', function (req, res) {
    let url;
    let sort = req.query.sort;
    switch(req.params.type) {
        case 'movies':
            if (sort === 'trending' && !req.query.genre) {
                url = 'https://api.themoviedb.org/3/trending/movie/week?&page=' + req.params.page +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
            } else {
                if (sort === 'trending') sort = 'popularity.desc';
                url = 'https://api.themoviedb.org/3/discover/movie/?page=' + req.params.page + '&sort_by=' + sort +
                    '&include_adult=false&include_video=false&vote_count.gte=100&release_date.lte=' + new Date().toISOString().split('T')[0] +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
                if (req.query.genre) url += '&with_genres=' + req.query.genre;
            }
            break;
        case 'shows':
            if (sort === 'trending' && !req.query.genre) {
                url = 'https://api.themoviedb.org/3/trending/tv/week?&page=' + req.params.page +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
            } else {
                if (sort === 'trending') sort = 'popularity.desc';
                url = 'https://api.themoviedb.org/3/discover/tv/?page=' + req.params.page + '&sort_by=' + sort +
                    '&include_adult=false&include_video=false&vote_count.gte=100&release_date.lte=' + new Date().toISOString().split('T')[0] +
                    '&api_key=' + process.env.THE_MOVIE_DB_KEY;
                if (req.query.genre) url += '&with_genres=' + req.query.genre;
            }
            break;
        default:
            break;
    }

    if (!url) {
        res.send([]);
    } else {
        axios.get(url).then(response => {
            res.send(response.data)
        }).catch(err => {
            console.error(err); res.send([]);
        });
    }
});

function checkTrackerCache(url, res) {
    if (trackerCache[url]) {
        res.send(trackerCache[url]);
    } else {
        axios.get(url).then(response => {
            trackerCache[url] = response.data;
            res.send(response.data);
        }).catch(err => {
            console.error(err);
            res.send([]);
        });
    }
}

app.get('/eztv/', function(req, res) {
    const url = `https://eztv.io/api/get-torrents?${querystring.stringify(req.query)}`;
    checkTrackerCache(url, res);
});

app.get('/nyaa/', function(req, res) {
    const url = `https://nyaa.pantsu.cat/api/search?${querystring.stringify(req.query)}`;
    checkTrackerCache(url, res);
});

function searchPirateBay(query, endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${endpoint.replace(/\/$/, '')}/search/${query}/1/99/200`;
        console.log(url);
        axios.get(url).then(response => {
            const $ = cheerio.load(response.data);
            const torrents = [];
            
            const table = $('#searchResult tbody').html();
            const rows = $('tr', table);
            
            const sizeRegex = new RegExp(/(\d|\.)+\s(KiB|MiB|GiB)/);
            const fullDateRegex = new RegExp(/\d{2}-\d{2}\s*\d{4}/);
            const partialDateRegex = new RegExp(/\d{2}-\d{2}/);
            
            rows.each((i, row) => {
                const name = $('.detName', row).text().trim();
                if (!name) return;
            
                const link = $('.detLink', row).attr('href');
                const magnetLink = $('[title="Download this torrent using magnet"]', row).attr('href');
                const sizeMatched = $('.detDesc', row).text().trim().match(sizeRegex);
                const seeds = $('[align="right"]', row).eq(0).text();
                const leeches = $('[align="right"]', row).eq(1).text();

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
                    leeches
                });
            });

            resolve(torrents);
        }).catch(err => {
            console.error(err);
            reject();
        });
    });
}

app.get('/pirate/:search', function(req, res) {
    const search = req.params.search;

    // Use the scraped PB from proxy for the search endpoint
    process.env.THEPIRATEBAY_DEFAULT_ENDPOINT = pirateBay;

    // Add a simple cache here to make things faster on the client
    if (trackerCache[search]) {
        res.send(trackerCache[search]);
    } else {
        searchPirateBay(search, 'https://thepiratebay0.org/').then(results => {
            trackerCache[search];
            res.send(results);
        }).catch(err => {
            res.send([]);
        });

        // PirateBay.search(req.params.search, {
        //     category: 'video',
        //     orderBy: 'seeds',
        //     sortBy: 'desc'
        // }).then(response => {
        //     trackerCache[search] = response;
        //     res.send(response);
        // }).catch(err => {
        //     console.error('pb', err);
        // });

        // petrus.baseUrl = pirateBay;
        // petrus.search(req.params.search).then(response => {
        //     trackerCache[search] = response;
        //     res.send(response);
        // }).catch(err => {
        //     res.send([]);
        //     console.error(err);
        // });
    }
});

app.get('/build', function (req, res) { res.send(BUILD_TIME); });
app.get('/docker', function (req, res) { res.send(IS_DOCKER); });
app.get('/plex', function (req, res) { res.send(process.env.PLEX_SERVER); });
app.get('/pb', function (req, res) { res.send(pirateBay); });
app.get('/session', function (req, res) { transmission.session((err, data) => handleResponse(res, err, data)); });
app.get('/torrents', function (req, res) { transmission.get((err, data) => handleResponse(res, err, data)); });
app.get('/torrents/:hash', function (req, res) { transmission.get(req.params.hash, (err, data) => handleResponse(res, err, data)); });
app.delete('/torrents/:hash', function (req, res) { transmission.remove(req.params.hash, true, (err, data) => handleResponse(res, err, data)); });

app.post('/torrents', function (req, res) {
    if (req.body.tv) {
        transmission.addUrl(req.body.url, { 'download-dir': '/TV' }, (err, data) => handleResponse(res, err, data));
    } else {
        transmission.addUrl(req.body.url, (err, data) => handleResponse(res, err, data));
    }
});

app.get('/upgrade', function (req, res) { res.send("Please POST to this endpoint with your upgrade key") });
app.post('/upgrade', function (req, res) {
    try {
        if (!IS_DOCKER) throw new Error('You can only use the upgrade endpoint from a docker container');
        const UPGRADE_KEY = process.env.UPGRADE_KEY;
        if (!UPGRADE_KEY || UPGRADE_KEY.length === 0) throw new Error('No upgrade key has been set, canceling upgrade');
        if (req.query.upgradeKey !== UPGRADE_KEY) throw new Error('Invalid upgrade key');
        if (isUpgrading) throw new Error('Already upgrading, please wait a bit and try again');

        // We are now in the upgrading state
        isUpgrading = true;

        console.log("starting upgrade");
        res.send("starting upgrade, remember to check the logs ;)");

        exec("ip route | awk '/default/ { print $3 }'", (error, stdout, stderr) => {
            if (!stderr) {
                const ip = stdout.trim();
                const ssh = "ssh -oStrictHostKeyChecking=no " + process.env.USERNAME + "@" + ip;
                const command = " 'nohup " + process.env.APP_DIR + "/scripts/upgrade.sh &'";
                console.log("running command: " + ssh + command);

                // Wait 2 minutes until another upgrade is allowed
                setTimeout(() => isUpgrading = false, 1000 * 120);

                exec(ssh + command, (error, stdout, stderr) => {
                    console.log(stdout);
                    if (stderr) console.error(stderr);
                });
            } else {
                console.error(stderr);
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500);
        res.send("Error: " + e.message);
    }
});

// Check if the cache has data, else grab it
function checkCache(url, res, shouldRetry) {
    if (cache[url]) {
        res.send(cache[url]);
    } else {
        cacheRequest(url, res, shouldRetry);
    }
}

// Stick things into a cache
function cacheRequest(url, res, shouldRetry) {
    axios.get(url, { timeout: 10000 }).then(response => {
        res.send(response.data);
        cache[url] = response.data;
        writeCache();
    }, error => {
        if (shouldRetry) {
            setTimeout(() => cacheRequest(url, res, false), 10000);
        } else {
            console.error(error);
            res.send(error);
        }
    });
}

function writeCache() {
    fs.writeFile(CACHE_FILE, JSON.stringify(cache), (err) => {
        if (err) console.error(err);
    });
}

// Single handler for all of the transmission wrapper responses
function handleResponse(res, err, data) {
    if (err) {
        console.error(err);
        res.status(500);
        res.send(err);
    } else {
        res.send(data);
    }
}

function autoPrune() {
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

    // Auto prune every minute
    setTimeout(autoPrune, 1000 * 60);
}

io.on('connection', client => {
    client.on('subscribe', data => {
        client.join(data);

        if (data === 'storage') client.emit('storage', currentStorage);
        if (data === 'torrents') client.emit('torrents', currentTorrents);
        if (data === 'files') client.emit('files', currentFiles);
    })
});

function setIntervalImmediately(func, interval) {
    func();
    return setInterval(func, interval);
}

function initSocketDataWatchers() {
    const interval = 2000;

    setIntervalImmediately(() => getStorage(data => {
        if (JSON.stringify(currentStorage) !== JSON.stringify(data)) {
            currentStorage = data;
            io.sockets.in('storage').emit('storage', currentStorage);
        }
    }), interval * 3);

    // TODO: Give a few failed attempts before killing UI because we cannot connect to transmission
    setIntervalImmediately(() => transmission.get((err, data) => {
        if ((data && JSON.stringify(currentTorrents) !== JSON.stringify(data)) ||
            (err && JSON.stringify(currentTorrents) !== JSON.stringify(err))) {
            currentTorrents = data || err;
            io.sockets.in('torrents').emit('torrents', currentTorrents);
        }
    }), interval);

    setIntervalImmediately(() => getFiles(data => {
        if (JSON.stringify(currentFiles) !== JSON.stringify(data)) {
            currentFiles = data;
            io.sockets.in('files').emit('files', currentFiles);
        }
    }), interval * 30);

    // Grab piratebay proxy list every 30 minutes
    setIntervalImmediately(() => axios.get('https://piratebayproxy.info').then(response => {
        const $ = cheerio.load(response.data);
        const links = $('.t1');
        // choose a random link from the top half of the list
        const rnd = Math.floor(Math.random() * links.length / 2);
        pirateBay = links.eq(rnd).attr('href');
    }).catch(err => {
        console.error(err);
        pirateBay = undefined;
    }), 1000 * 60 * 30);
}
