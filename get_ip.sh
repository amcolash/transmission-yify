echo Starting IP service
touch /data/ip.txt

# Wait for vpn to start up
sleep 20

# Every minute check our ip address, write to shared file
while true
do 
    curl -s http://ipinfo.io/ip > /data/ip.txt 
    sleep 60
done &