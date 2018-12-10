#!/bin/sh

echo Waiting a moment, just for the dust to settle
sleep 20

git pull

pm2 restart UpgradeTransmission

docker-compose down
docker-compose pull
docker-compose up -d
