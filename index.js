'use strict';

const axios = require('axios');
const cors = require('cors');
const { exec } = require('child_process');
const express = require('express');
const fs = require('fs');
const path = require('path');
const transmissionWrapper = require('transmission');

require('dotenv').config();

// Init vars
const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = 9000;

var currentTorrents = [];
var currentStorage;
var currentFiles = [];

var cache = {};
var isUpgrading = false;

// App
const app = express();
app.use(express.json());
app.use(cors());

const server = require('http').createServer(app);  
const io = require('socket.io')(server);

// Transmission wrapper, conditional host based on if running from a docker container
const transmission = new transmissionWrapper({ host: IS_DOCKER ? 'transmission' : '127.0.0.1' });

// Get this party started!
try {
    // Set up data dir if not in docker environment
    if (!IS_DOCKER) {
        fs.accessSync(process.env.DATA_DIR, (err) => {
            fs.mkdirSync(process.env.DATA_DIR, { recursive: true }, (err) => {
                if (err) console.error(err);
            });
        });
    }

    // Setup cache
    fs.accessSync((IS_DOCKER ? '/data' : process.env.DATA_DIR) + '/cache.json', (err) => {
        if (err) {
            fs.writeFileSync((IS_DOCKER ? '/data' : process.env.DATA_DIR) + '/cache.json', JSON.stringify({}), err => {
                if (err) console.error(err);
            });
        } else {
            cache = require((IS_DOCKER ? '/data' : process.env.DATA_DIR) + '/cache');
        }
    });    

    server.listen(PORT);
    console.log(`Running on port ${PORT}`);

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
            let ip = fs.readFileSync('/data/ip.txt', 'utf8');
            handleIP(ip, res);
        } else {
            axios.get('http://ipinfo.io/ip').then(response => {
                handleIP(response.data, res);
            });
        }
    } catch(err) {
        console.error(err);
        res.send('unknown');
    }
});

function handleIP(ip, res) {
    axios.get('https://api.ipdata.co/' + ip.trim() + '?api-key=' + process.env.IP_KEY).then(response => {
        res.send(response.data);
    }, error => {
        console.error(error);
        res.send(ip);
    });
}

app.get('/storage', function (req, res) { getStorage(data => res.send(data)); });

function getStorage(cb) {
    exec('df ' + (IS_DOCKER ? '/data' : process.env.DATA_DIR) + " | grep -v 'Use%' | awk '{ print $5 }'", function (err, output) {
        if (err) {
            console.error(err);
            cb('unknown');
        } else {
            cb({ used: output.replace('%', '').trim() });
        }
    });
}

function getFiles(cb) {
    exec('find ' + (IS_DOCKER ? '/data' : process.env.DATA_DIR), function(err, stdout, stderr) {
        if (err) {
            console.log(err);
            cb([]);
        } else {
            var file_list = stdout.split('\n');
            var files = [];
            file_list.map(file => {
                const f = path.basename(file);
                if (f.length > 0) files.push(f.replace(/\./g, ' '))
            });
            cb(files);
        }
    });
}

app.get('/omdb/:id', function(req, res) {
    let url ='http://www.omdbapi.com/?apikey=' + process.env.OMDB_KEY + '&i=' + req.params.id;
    checkCache(url, res, true);
});

app.get('/themoviedb/:id', function (req, res) {
    let url = 'https://api.themoviedb.org/3/find/' + req.params.id + '?external_source=imdb_id&api_key=' + process.env.THE_MOVIE_DB_KEY;
    checkCache(url, res, true);
});

app.get('/docker', function (req, res) { res.send(IS_DOCKER); });
app.get('/plex', function (req, res) { res.send(process.env.PLEX_SERVER); });
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
                const command = " 'nohup " + process.env.APP_DIR + "/upgrade.sh &'";
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
        fs.writeFile((IS_DOCKER ? '/data' : process.env.DATA_DIR) + '/cache.json', JSON.stringify(cache), (err) => {
            if (err) console.error(err);
        });
    }, error => {
        if (shouldRetry) {
            setTimeout(() => cacheRequest(url, res, false), 10000);
        } else {
            console.error(error);
            res.send(error);
        }
    });
}

// Single handler for all of the transmission wrapper responses
function handleResponse(res, err, data) {
    if (err) {
        console.error(err);
        res.send(err);
    } else {
        res.send(data);
    }
}

function autoPrune() {
    // Max wait time after complete is 3 days
    const maxWait = 60 * 60 * 24 * 3;

    if (currentTorrents.length > 0) {
        currentTorrents.map(torrent => {
            let uploadComplete = torrent.uploadRatio > 3.0;
            let expired = (Date.now() / 1000) > (torrent.doneDate + maxWait);
    
            if (torrent.percentDone === 1.0 && (uploadComplete || (expired && torrent.doneDate > 0))) {
                // Soft remove (keep data but stop uploading)
                console.log('removing complete torrent: ' + torrent.name + (uploadComplete ? ', upload complete' : '') + (expired ? ', expired' : ''));
    
                transmission.remove(torrent.hashString, false, (err) => {
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

function initSocketDataWatchers() {
    const interval = 2000;

    setInterval(() => getStorage(data => {
        if (JSON.stringify(currentStorage) !== JSON.stringify(data)) {
            currentStorage = data;
            io.sockets.in('storage').emit('storage', currentStorage);
        }
    }), interval);

    setInterval(() => transmission.get((err, data) => {
        if ((data && JSON.stringify(currentTorrents) !== JSON.stringify(data)) ||
            (err && JSON.stringify(currentTorrents) !== JSON.stringify(err))) {
            currentTorrents = data || []; // NO_COMMIT
            io.sockets.in('torrents').emit('torrents', currentTorrents);
        }
    }), interval);

    setInterval(() => getFiles(data => {
        if (JSON.stringify(currentFiles) !== JSON.stringify(data)) {
            currentFiles = data;
            io.sockets.in('files').emit('files', currentFiles);
        }
    }), interval);
}