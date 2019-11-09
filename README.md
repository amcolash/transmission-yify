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

### NGINX Proxy
I needed to use an nginx proxy for analytics to work with a docker environment (normally the request ip is masked by getting routed though docker). Using nginx allows me to pass things like `X-Forwarded-For` which allows getting an accurate address from the proxy before being passed into docker. Here is my nginx site config (saved to `/etc/nginx/sites-enabled/transmission-yify.conf`). I didn't commit this file to the repo as it will never change.

```
server {
  listen 9000 ssl;

  location / {
    proxy_set_header        Host                $host;
    proxy_set_header        X-Real-IP           $remote_addr;
    proxy_set_header        X-Forwarded-For     $proxy_add_x_forwarded_for;
    proxy_set_header        X-Forwarded-Proto   $scheme;

    proxy_pass https://localhost:9090;
  }
}
```

## Icons
All icons in the application are from [Font Awesome](https://fontawesome.com/icons/). The app icon was created by myself in inkscape.

---

This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).
