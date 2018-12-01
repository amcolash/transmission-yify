const express = require('express');
const spawn = require('child_process').spawn;

// Get env vars
//require('dotenv').config();
const UPGRADE_KEY = process.env.UPGRADE_KEY;

// Make server
const PORT = 9001;
const app = express();
app.listen(PORT);
console.log(`Running on port ${PORT}`);

// Handle upgrade
app.post('/upgrade', function (req, res) {
    if (req.query.upgradeKey === UPGRADE_KEY) {
        res.send("starting upgrade, remember to check the logs ;)")
        console.log("starting upgrade");

        const proc = spawn('sh', ['upgrade.sh'], { cwd: './' });
        proc.stdout.on('data', data => console.log(data.toString()));
        proc.stderr.on('data', data => console.error(data.toString()));
        proc.on('exit', code => {
            console.log("upgrade exited with code " + code);
        });
    } else {
        res.send("invalid upgrade key!");
        console.error("invalid upgrade key");
    }
});
