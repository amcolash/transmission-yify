echo Starting IP service
while true
do 
    curl -s http://ipinfo.io/ip > /data/ip.txt 
    sleep 60
done