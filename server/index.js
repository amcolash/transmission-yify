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
const workerpool = require('workerpool');

const piratePool = workerpool.pool(__dirname + '/pirate.js', {maxWorkers: 6});
const { getEZTVDetails, getEZTVShows, updateEZTVShows } = require('./eztv');
const { updateHorribleSubsShows, getHorribleSubsDetails, getHorribleSubsShows } = require('./horriblesubs');

const { getPlexFiles } = require('./plex');
const { autoPrune, filterMovieResults, getEpisodes, searchShow } = require('./util');

require('dotenv').config();


// Init vars
const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = 9000;
const DATA = (IS_DOCKER ? '/data' : process.env.DATA_DIR);
const CACHE_FILE = DATA + '/cache.json';
const SUBSCRIPTION_FILE = DATA + '/subscriptions.json';
const interval = 2000;

let currentTorrents = [];
let currentFiles = [];

let prevStatus = {};
let currentStatus = {
    buildTime: 'Dev Build',
    isDocker: IS_DOCKER,
    plex: process.env.PLEX_SERVER,
    subscriptions: [],
    pirateBay: 'https://thepiratebay10.org/'
};

let cache = {};
let trackerCache = {};
let isUpgrading = false;

// Figure out build time
if (fs.existsSync('./build_time') && IS_DOCKER) {
    try {
        currentStatus.buildTime = new Date(fs.readFileSync('./build_time'));
    } catch (err) {
        console.error(err);
    }
}

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

// Auto clean torrent cache every 12 hours
new CronJob('00 00 */12 * * *', function() {
    console.log('scheduled clearing of tracker cache');
    trackerCache = {};
}, null, true, 'America/Los_Angeles');

// Wipe the full cache weekly at 4am on sunday/wednesday morning
new CronJob('00 00 4 * * 0,3', function() {
    console.log('scheduled clearing of main cache');
    clearCache();
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
        if (fs.existsSync(CACHE_FILE)) cache = require(CACHE_FILE);
        else writeCache();
    } catch (err) {
        console.error(err);
        writeCache();
    }

    // Setup subscription file
    try {
        if (fs.existsSync(SUBSCRIPTION_FILE)) currentStatus.subscriptions = require(SUBSCRIPTION_FILE);
        else writeSubscriptions();
    } catch (err) {
        console.error(err);
        writeSubscriptions();
    }

    server.listen(PORT);
    console.log(`Running on port ${PORT}`);
    if (typeof(currentStatus.buildTime) !== 'string') console.log(`Docker image build time ${currentStatus.buildTime}`);

    // Init socket watchers
    initSocketDataWatchers();

    // Init status watchers
    initStatusWatchers();
} catch (err) {
    console.error(err);
}

// Set up static content, cache for a little bit
app.use('/', express.static('build', IS_DOCKER ? { maxAge: '4h' } : {}));

app.get('/omdb/:id', function(req, res) {
    let url ='https://www.omdbapi.com/?apikey=' + process.env.OMDB_KEY + '&i=' + req.params.id;
    checkCache(url, res, true);
});

app.get('/tmdbid/:type/:id', function(req, res) {
    const type = req.params.type;
    const id = req.params.id;
    const url = getTMDBUrl(id, type);
    checkCache(url, res, true);
});

app.get('/tmdb/seasons/:id/:season', function (req, res) {
    let url = `https://api.themoviedb.org/3/tv/${req.params.id}/season/${req.params.season}?api_key=${process.env.THE_MOVIE_DB_KEY}`;
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

    checkCache(url, res);
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

    if (!url) res.send([]);
    
    checkCache(url, res);
});

app.get('/nyaa/:precache?', function(req, res) {
    const url = `https://nyaa.pantsu.cat/api/search?${querystring.stringify(req.query)}`;
    checkTrackerCache(url, req.params.precache ? undefined : res);
    if (req.params.precache) res.sendStatus(200);
});

app.get('/status', function (req, res)  { res.send(currentStatus); });
app.get('/session', function (req, res) { transmission.session((err, data) => handleResponse(res, err, data)); });
app.get('/torrents', function (req, res) { transmission.get((err, data) => handleResponse(res, err, data)); });
app.get('/torrents/:hash', function (req, res) { transmission.get(req.params.hash, (err, data) => handleResponse(res, err, data)); });
app.delete('/torrents/:hash', function (req, res) { transmission.remove(req.params.hash, req.query.deleteFiles == 'true', (err, data) => handleResponse(res, err, data)); });

app.post('/torrents', function (req, res) {
    if (req.body.tv) {
        transmission.addUrl(req.body.url, IS_DOCKER ? { 'download-dir': '/TV' } : {}, (err, data) => handleResponse(res, err, data));
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

app.post('/subscriptions', function (req, res) {
    const id = Number.parseInt(req.query.id);

    const matched = findSubscription(id);
    if (matched) {
        res.sendStatus(403);
        return;
    }

    res.sendStatus(200);
    console.log('subscribing to ' + id);
    downloadSubscription(id, true);
});

app.delete('/subscriptions', function(req, res) {
    const id = Number.parseInt(req.query.id);
    const matched = findSubscription(id);
    if (matched) {
        res.sendStatus(200);
        console.log(`unsubscribing from ${matched.title} (${id})`);
        currentStatus.subscriptions = currentStatus.subscriptions.filter(s => s.id !== id);
        writeSubscriptions();
    } else {
        res.sendStatus(404);
    }
});

app.delete('/cache', function (req, res) {
    const KEY = process.env.UPGRADE_KEY;
    if (!KEY || KEY.length === 0) throw new Error('No key has been set, canceling cache clean');
    if (req.query.key !== KEY) throw new Error('Invalid key');

    console.log('clearing cache via endpoint')
    clearCache();
    trackerCache = {};

    res.sendStatus(200);
});

app.get('/pirate/:search/:precache?', function(req, res) {
    const search = req.params.search;
    const filter = req.query.all ? '/99/0' : '/99/200';
    const cacheName = search + (req.query.page ? `-page${req.query.page}` : '') + (req.query.movie ? '-movie' : '') + filter;
    if (req.params.precache) {
        res.sendStatus(200);
        return;
    }

    // Add a simple cache here to make things faster on the client
    if (trackerCache[cacheName]) {
        // cache for 6 hours
        if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
        res.send(trackerCache[cacheName]);
    } else {
        piratePool.exec('searchPirateBay', [search, req.query.page || 1, filter, currentStatus.pirateBay])
        .then(results => {
            // Filter if we asked specifically for movies
            if (req.query.movie) results = filterMovieResults(results);
            
            // cache for 6 hours
            if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
            res.send(results);
            trackerCache[cacheName] = results;
        }).catch(err => {
            console.error(err);
            res.send({page:1,total:0,limit:30,torrents:[]});
        });
    }
});

app.get('/eztv/:search', function(req, res) {
    const search = req.params.search;
    const match = searchShow(search, getEZTVShows());

    if (match) {
        const url = match.url;

        // Add a simple cache here to make things faster on the client
        if (trackerCache[url]) {
            // cache for 6 hours
            if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
            res.send(trackerCache[url]);
        } else {
            getEZTVDetails(url).then(torrents => {
                if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
                res.send(torrents);
                trackerCache[url] = torrents;
            });
        }
    } else {
        res.send({page:1,total:0,limit:30,torrents:[]});
    }
});

app.get('/horriblesubs/:search', function(req, res) {
    const search = req.params.search;
    const match = searchShow(search, getHorribleSubsShows());
    
    if (match) {
        const url = match.url;

        // Add a simple cache here to make things faster on the client
        if (trackerCache[url]) {
            // cache for 6 hours
            if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
            res.send(trackerCache[url]);
        } else {
            getHorribleSubsDetails(url).then(torrents => {
                if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
                res.send(torrents);
                trackerCache[url] = torrents;
            });
        }
    } else {
        res.send({page:1,total:0,limit:30,torrents:[], batches: []});
    }
});

io.on('connection', client => {
    client.on('subscribe', data => {
        client.join(data);

        if (data === 'status') client.emit('status', currentStatus);
        if (data === 'torrents') client.emit('torrents', currentTorrents);
        if (data === 'files') client.emit('files', currentFiles);
    })
});

function getTMDBUrl(id, type) {
    return 'https://api.themoviedb.org/3/' + type + '/' + id + '?api_key=' + process.env.THE_MOVIE_DB_KEY + 
        '&append_to_response=external_ids,videos,recommendations' + (type === 'tv' ? ',content_ratings' : '');
}

function clearCache() {
    cache = {};
    writeCache();
}

function filterTV(url, data) {
    if (url.indexOf('https://api.themoviedb.org') !== -1 && url.indexOf('tv') !== -1 &&
        (url.indexOf('search') !== -1 || url.indexOf('discover') !== -1)) {
        data.results = data.results.filter(show => {
            return searchShow(show.original_name, getEZTVShows()) !== undefined;
        });
    }

    return data;
}

// Check if the cache has data, else grab it
function checkCache(url, res, shouldRetry) {
    if (cache[url]) {
        // cache for 1 day
        if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=86400');
        res.send(cache[url]);
    } else {
        cacheRequest(url, res, shouldRetry);
    }
}

// Stick things into a cache
function cacheRequest(url, res, shouldRetry) {
    axios.get(url, { timeout: 10000 }).then(response => {
        const data = filterTV(url, response.data);

        // cache for 1 day
        if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=86400');
        res.send(data);
        cache[url] = data;
        writeCache();
    }).catch(error => {
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

function writeSubscriptions() {
    fs.writeFile(SUBSCRIPTION_FILE, JSON.stringify(currentStatus.subscriptions), (err) => {
        if (err) console.error(err);
    });
}

function checkTrackerCache(url, res) {
    if (trackerCache[url]) {
        if (res) {
            // cache for 6 hours
            if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
            res.send(trackerCache[url]);
        }
    } else {
        axios.get(url).then(response => {
            if (res) {
                // cache for 6 hours
                if (IS_DOCKER) res.set('Cache-Control', 'public, max-age=21600');
                res.send(response.data);
            }
            trackerCache[url] = response.data;
        }).catch(err => {
            console.error(err);
            if (res) res.send([]);
        });
    }
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

function findSubscription(id) {
    const matched = currentStatus.subscriptions.filter(s => s.id === id);
    return matched.length === 1 ? matched[0] : undefined;
}

async function downloadSubscription(id, onlyLast) {
    // Get the current subscription status
    const matched = findSubscription(id);
    let subscription = matched || {};

    // Always grab new data for the show
    const url = getTMDBUrl(id, 'tv');
    let data;
    if (cache[url]) {
        data = cache[url];
    } else {
        try {
            const res = await axios.get(url);
            data = res.data;
        } catch (err) {
            console.error(err);
            return; // bail, things went wrong getting data
        }
    }

    // handle things this way so that the data stored is upgraded on the fly, it modifies the existing object this way
    subscription.id = id;
    subscription.imdb = data.external_ids.imdb_id;
    subscription.title = data.name;
    subscription.year = new Date(data.first_air_date).getFullYear();
    subscription.poster_path = 'https://image.tmdb.org/t/p/w300_and_h450_bestv2/' + data.poster_path;

    // Only update these if needed
    subscription.lastSeason = subscription.lastSeason || 0;
    subscription.lastEpisode = subscription.lastEpisode || 0;

    // Add a new entry if it does not exist
    if (!matched) currentStatus.subscriptions.push(subscription);

    // write to file so we keep retrying if things fail below, also keep modified fields
    writeSubscriptions();

    // find torrents for the show
    const matchedShow = searchShow(subscription.title, getEZTVShows());
    getEZTVDetails(matchedShow.url).then(data => {
        // Generate a list of all episodes from the query
        const { episodes, lastEpisode } = getEpisodes(subscription, data.torrents, onlyLast);

        if (episodes.length > 0) console.log(`need to get ${episodes.length} new files for ${subscription.title}`);

        // Download each torrent
        episodes.forEach(e => {
            console.log('Downloading new subscribed file: ' + e.filename);
            transmission.addUrl(e.magnet, IS_DOCKER ? { 'download-dir': '/TV' } : {}, (err, data) => {
                if (err) console.error(err);
            });
        });

        // Update subscription
        subscription.lastSeason = lastEpisode.season;
        subscription.lastEpisode = lastEpisode.episode;
        writeSubscriptions();
    }).catch(err => {
        console.error(err);
    });
}

function setIntervalImmediately(func, interval) {
    func();
    return setInterval(func, interval);
}

function initSocketDataWatchers() {
    setIntervalImmediately(() => {
        if (JSON.stringify(currentStatus) !== JSON.stringify(prevStatus)) {
            // Do a copy via stringify/parse since we are modifying objects with subscriptions
            prevStatus = JSON.parse(JSON.stringify(currentStatus));
            io.sockets.in('status').emit('status', currentStatus);
        }
    }, interval);

    // TODO: Give a few failed attempts before killing UI because we cannot connect to transmission
    setIntervalImmediately(() => transmission.get((err, data) => {
        if ((data && JSON.stringify(currentTorrents) !== JSON.stringify(data)) ||
            (err && JSON.stringify(currentTorrents) !== JSON.stringify(err))) {
            currentTorrents = data || err;
            io.sockets.in('torrents').emit('torrents', currentTorrents);
        }
    }), interval);

    setIntervalImmediately(() => getPlexFiles().then(data => {
        if (JSON.stringify(currentFiles) !== JSON.stringify(data)) {
            currentFiles = data;
            io.sockets.in('files').emit('files', currentFiles);
        }
    }), interval * 150);
}

function initStatusWatchers() {
    // Autoprune every minute
    setIntervalImmediately(() => autoPrune(currentTorrents, transmission), interval * 30);

    // Grab piratebay proxy list every 10 minutes
    setIntervalImmediately(() => axios.get('https://piratebayproxy.info').then(response => {
        const $ = cheerio.load(response.data);
        const links = $('.t1');
        // choose a random link from the top half of the list
        const rnd = Math.floor(Math.random() * links.length / 2);
        currentStatus.pirateBay = links.eq(rnd).attr('href');
    }).catch(err => {
        console.error(err);
    }), interval * 300);

    // Get storage info every minute
    setIntervalImmediately(() => {
        exec('df ' + DATA + " | grep -v 'Use%' | awk '{ print $5 }'", function (err, output) {
            if (err) {
                console.error(err);
                currentStatus.storageUsage = 'unknown';
            } else {
                currentStatus.storageUsage = output.replace('%', '').trim();
            }
        });

        fs.stat(CACHE_FILE, (err, stats) => {
            if (err) {
                currentStatus.cacheUsage = 'unknown';
            } else {
                const fileSizeInBytes = stats["size"];
                const fileSizeInMegabytes = (fileSizeInBytes / Math.pow(1024, 2)).toFixed(1);
                currentStatus.cacheUsage = `${fileSizeInMegabytes} MB`;
            }
        });
    }, interval * 30);

    // Wait a moment to set it up so that transmission has time to start
    setTimeout(() => {
        // Update IP address every 5 minutes
        setIntervalImmediately(() => {
            try {
                let ip;
                if (IS_DOCKER && fs.existsSync(DATA + '/ip.txt')) ip = fs.readFileSync(DATA + '/ip.txt', 'utf8');
        
                axios.get(`https://api.ipdata.co/${(ip ? ip.trim() : '')}?api-key=${process.env.IP_KEY}`).then(response => {
                    const data = response.data;
                    currentStatus.ip = { city: data.city, country: data.country_name, country_code: data.country_code, region: data.region,
                        region_code: data.region_code };
                }, error => {
                    console.error(error);
                });
            } catch (err) {
                console.error(err);
            }
        }, interval * 150);

        // Check subscriptions every hour
        setIntervalImmediately(() => {
            currentStatus.subscriptions.forEach(subscription => {
                downloadSubscription(subscription.id, false);
            });
        }, interval * 30 * 60);
    }, IS_DOCKER ? interval * 30 : interval * 5);

    // Refresh list of eztv / horriblesubs shows every day
    const day = 1000 * 60 * 60 * 24;
    setIntervalImmediately(() => updateEZTVShows(), day);
    setIntervalImmediately(() => updateHorribleSubsShows(), day);
}