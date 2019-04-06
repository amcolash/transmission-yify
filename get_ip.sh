#!/bin/bash

echo Starting IP service
touch /data/ip.txt

# Every minute check our ip address, write to shared file
# NOTE: The first ip address will be incorrect since the vpn service has not started
while true
do 
    curl -s https://ifconfig.me > /data/ip.txt
    sleep 60
done &