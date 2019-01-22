#!/bin/sh

# Move into the root of the app directory
cd $(dirname "$0")

# Redirect all output to log file
set -o errexit
readonly LOG_FILE="upgrade.log"
touch $LOG_FILE
exec 1>$LOG_FILE
exec 2>&1

echo "----------------"
echo $(date)
echo "Starting Upgrade"

echo Waiting a moment for the dust to settle
sleep 60

git pull

docker-compose pull
docker-compose down
docker-compose up -d

echo "Upgrade Complete"
echo $(date)
echo "----------------"