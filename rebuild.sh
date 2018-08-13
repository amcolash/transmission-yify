#!/bin/bash
imageName=amcolash/transmission-yify
containerName=transmission-yify

echo Stopping container...
docker stop $containerName

echo Delete old container...
docker rm -f $containerName

echo Delete old image...
docker rm -f $imageName

docker build -t $imageName -f Dockerfile  .

echo Run new container...
docker run -p 9000:9000 -d --name $containerName $imageName