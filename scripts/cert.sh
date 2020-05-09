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

echo "All done! Make sure to turn on chrome://flags/#allow-insecure-localhost as well if things aren't working properly"