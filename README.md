# transmission-yify
[![Travis (.org)](https://img.shields.io/travis/amcolash/transmission-yify.svg)](https://travis-ci.org/amcolash/transmission-yify)

A react app, an Express server and a torrent client walk into a container...

A react app + express server that show info and download from the popcorn and yify apis.

This is an educational testing ground of using real life apis and technologies. Don't pirate copyrighted content.

## Setup
No matter how you get set up, you will need to clone the repo
`git clone https://github.com/amcolash/transmission-yify.git`

And edit your `.env` file. Check the code for all of those env vars.

After that, the easiest way to set everything up (without building) is using docker. `docker-compose up`

### Building Docker Image
Use compose: `docker-compose build`.

### Building Client
To build the react client, simply run `npm build`.

### Local Dev
The local dev flow has a script to start all necessary bits in a dev environment (server, client, transmission) `npm start`.

## Icons
All icons in the application are from [Font Awesome](https://fontawesome.com/icons/). The app icon was created by myself in inkscape.

---

This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).
