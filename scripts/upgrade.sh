#!/bin/sh

# Fail script if anything fails, maybe not the best...
set -o errexit

# If on synology, start entware first
if [ -f /opt/etc/profile ]; then
    # Load Entware Profile
    . /opt/etc/profile
    export PATH=/usr/local/bin:$PATH
fi

# Move into the root of the app directory
cd $(dirname "$0")
cd ../

# Redirect all output to log file
readonly LOG_FILE="upgrade.log"
touch $LOG_FILE
exec >> $LOG_FILE 2>&1 && tail $LOG_FILE

echo "----------------"
echo $(date)
echo "Starting Upgrade"

echo "Waiting a moment for the dust to settle"
sleep 20

git pull

docker-compose pull
docker-compose down
docker-compose up -d

echo "Upgrade Complete"
echo $(date)
echo "----------------"