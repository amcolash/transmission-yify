#!/bin/sh

echo Waiting a moment, just for the dust to settle
sleep 20

git pull

docker-compose down
docker-compose pull
docker-compose up -d

pm2 restart UpgradeTransmission