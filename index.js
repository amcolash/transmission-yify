'use strict';

const axios = require('axios');
const cors = require('cors');
const express = require('express');
const transmissionWrapper = require('transmission');
const { exec } = require('child_process');

// Constants
const PORT = 9000;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(express.json());
app.use(cors());

// Transmission wrapper
const transmission = new transmissionWrapper();

// Set up static content
app.use('/', express.static('build'));

// Yuck, this makes it so we don't need to modify the transmission image - it works I guess...
app.get('/ip', function (req, res) {
    exec('docker exec -i transmission sh -c "curl http://ipinfo.io/ip"', function (err, output) {
        if (!err) {
            res.send(output);
        } else {
            console.error(err);
            axios.get('http://ipinfo.io/ip').then(function (response) {
                res.send(response.data);
            }).catch(function (error) {
                res.status(500).send("Error: " + error);
            });
        }
    });
});

app.get('/storage', function (req, res) { transmission.freeSpace('/data', (err, data) => handleResponse(res, err, data)); });
app.get('/torrents', function (req, res) { transmission.get((err, data) => handleResponse(res, err, data)); });
app.get('/torrents/:hash', function (req, res) { transmission.get(req.params.hash, (err, data) => handleResponse(res, err, data)); });
app.delete('/torrents/:hash', function (req, res) { transmission.remove(req.params.hash, true, (err, data) => handleResponse(res, err, data)); });
app.post('/torrents', function (req, res) { transmission.addUrl(req.body.url, (err, data) => handleResponse(res, err, data)); });
app.get('/session', function (req, res) { transmission.session((err, data) => handleResponse(res, err, data)); });

// Single handler for all of the transmission wrapper responses
function handleResponse(res, err, data) {
    if (err) {
        res.send(err);
    } else {
        res.send(data);
    }
}

function autoPrune() {
    transmission.get((err, data) => {
        if (!err) {
            // Max wait time after complete is 3 days
            const maxWait = 60 * 60 * 24 * 3;
            
            data.torrents.map(torrent => {
                let uploadComplete = torrent.uploadRatio > 3.0;
                let expired = (Date.now() / 1000) > (torrent.doneDate + maxWait);

                if (torrent.percentDone === 1.0 && (uploadComplete || (expired && torrent.doneDate > 0))) {
                    // Soft remove (keep data but stop uploading)
                    console.log("removing complete torrent: " + torrent.name + (uploadComplete ? ", upload complete" : "") + (expired ? ", expired" : ""));

                    transmission.remove(torrent.hashString, false, (err, data) => {
                        if (err) console.error(err);
                    });
                }
            });
        }
    });
}

// Get this party started!
try {
    app.listen(PORT, HOST);
    console.log(`Running on http://${HOST}:${PORT}`);

    // Autoprune on start
    autoPrune();
    // Autoprune every minute after
    setInterval(autoPrune, 1000 * 60);
} catch (err) {
    console.error(err);
}