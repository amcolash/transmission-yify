'use strict';

const axios = require('axios');
const cors = require('cors');
const { exec } = require('child_process');
const express = require('express');
const fs = require('fs');
const transmissionWrapper = require('transmission');

require('dotenv').config();

// Constants
const IS_DOCKER = fs.existsSync('/.dockerenv');
const PORT = IS_DOCKER ? 9000 : 9001;

// App
const app = express();
app.use(express.json());
app.use(cors());

// Transmission wrapper, conditional host based on if running from a docker container
const transmission = new transmissionWrapper({ host: IS_DOCKER ? 'transmission' : '0.0.0.0'});

// Set up static content
app.use('/', express.static('build'));

app.get('/ip', function (req, res) {
    try {
        var file = fs.readFileSync("/data/ip.txt", "utf8").trim();

        axios.get('https://api.ipdata.co/' + file + "?api-key=" + process.env.IP_KEY).then(response => {
            res.send(response.data);
        }, error => {
            console.error(error);
            res.send(file);
        });
    } catch(err) {
        console.error(err);
        res.send("unknown");
    }
});

app.get('/storage', function (req, res) {
    exec("df " + (IS_DOCKER ? "/data" : process.env.DATA_DIR) + " | grep -v 'Use%' | awk '{ print $5 }'", function (err, output) {
        if (err) {
            console.error(err);
            res.send("unknown");
        } else {
            res.send({ used: output.replace("%", "").trim() });
        }
    });
});

app.get('/imdb/:id', function(req, res) {
    axios.get('http://www.omdbapi.com/?apikey=' + process.env.OMDB_KEY + '&i=' + req.params.id, { timeout: 10000 }).then(response => {
        res.send(response.data);
    }, error => {
        console.error(error);
        res.send(error);
    });
});

app.get('/torrents', function (req, res) { transmission.get((err, data) => handleResponse(res, err, data)); });
app.get('/torrents/:hash', function (req, res) { transmission.get(req.params.hash, (err, data) => handleResponse(res, err, data)); });
app.delete('/torrents/:hash', function (req, res) { transmission.remove(req.params.hash, true, (err, data) => handleResponse(res, err, data)); });
app.post('/torrents', function (req, res) { transmission.addUrl(req.body.url, (err, data) => handleResponse(res, err, data)); });
app.get('/session', function (req, res) { transmission.session((err, data) => handleResponse(res, err, data)); });

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

                    transmission.remove(torrent.hashString, false, (err) => {
                        if (err) console.error(err);
                    });
                }
            });
        }
    });
}

// Get this party started!
try {
    app.listen(PORT);
    console.log(`Running on port ${PORT}`);

    // Autoprune on start
    autoPrune();
    // Autoprune every minute after
    setInterval(autoPrune, 1000 * 60);
} catch (err) {
    console.error(err);
}