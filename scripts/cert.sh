#/bin/bash

if ! [ -x "$(command -v mkcert)" ]; then
    echo "mkcert not installed, now installing..."
    pushd /tmp
    wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64
    chmod +x mkcert-v1.4.1-linux-amd64
    sudo mv mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
    popd
fi

mkcert -install
mkcert localhost

cat localhost-key.pem >> combined.pem
cat localhost.pem >> combined.pem

mv localhost.pem .cert/cert.pem
mv localhost-key.pem .cert/privkey.pem
mv combined.pem .cert/combined.pem

# From https://gist.github.com/eladmoshe/0ca3f60952a7c4c24ab9aa028e0873bf
TARGET_LOCATION=$(pwd)/node_modules/webpack-dev-server/ssl/server.pem
SOURCE_LOCATION=$(pwd)/.cert/combined.pem

rm -f ${TARGET_LOCATION} || true
ln -s ${SOURCE_LOCATION} ${TARGET_LOCATION}
chmod 400 ${TARGET_LOCATION} # after 30 days create-react-app tries to generate a new certificate and overwrites the existing one. 
echo "Created server.pem symlink"

echo "All done! Make sure to turn on chrome://flags/#allow-insecure-localhost as well if things aren't working properly"