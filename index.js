'use strict';

const axios = require('axios');
const express = require('express');
const transmissionWrapper = require('transmission');
const { exec } = require('child_process');

// Constants
const PORT = 9000;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    express.json();
    next();
});

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
app.put('/torrents', function (req, res) { transmission.addUrl(req.body.url, (err, data) => handleResponse(res, err, data)); });
app.get('/session', function (req, res) { transmission.session((err, data) => handleResponse(res, err, data)); });

// Single handler for all of the transmission wrapper responses
function handleResponse(res, err, data) {
    if (err) {
        res.send(err);
    } else {
        res.send(data);
    }
}

// Get this party started!
try {
    app.listen(PORT, HOST);
    console.log(`Running on http://${HOST}:${PORT}`);
} catch (err) {
    console.error(err);
}