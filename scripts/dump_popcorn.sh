#!/bin/bash

mkdir -p db_dumps
pushd db_dumps

if [ -f "animes.json" ]; then
  mv -n "animes.json" "animes_$(date -r "animes.json" +"%Y%m%d_%H%M%S").json"
fi

if [ -f "shows.json" ]; then
  mv -n "shows.json" "shows_$(date -r "shows.json" +"%Y%m%d_%H%M%S").json"
fi

if [ -f "movies.json" ]; then
  mv -n "movies.json" "movies_$(date -r "movies.json" +"%Y%m%d_%H%M%S").json"
fi

wget -O animes.json http://tv-v2.api-fetch.website/exports/anime
wget -O shows.json http://tv-v2.api-fetch.website/exports/show
wget -O movies.json http://tv-v2.api-fetch.website/exports/movie

popd