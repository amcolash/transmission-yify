#!/bin/bash

# Wait a moment for vpn to initialize itself
sleep 10

# Make sure the ip file exists
touch /var/lib/transmission-daemon/ip.txt

# Every 30 seconds check our ip address, write to mounted file
# NOTE: The first ip address could be incorrect since the vpn service may have not started
while true
do 
    curl -s https://ifconfig.me > /var/lib/transmission-daemon/ip.txt
    # echo Current IP: "$(</var/lib/transmission-daemon/ip.txt)"
    sleep 30
done &

# Start main transmission process
/usr/bin/transmission.sh