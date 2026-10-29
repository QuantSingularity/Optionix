#!/bin/bash
# Generate self-signed SSL certificates for development
set -e

CERT_DIR="$(dirname "$0")/../nginx/ssl"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/server.crt" ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -subj "/C=US/ST=State/L=City/O=Optionix/CN=localhost"
    chmod 600 "$CERT_DIR/server.key"
    echo "Certificate generated at $CERT_DIR"
else
    echo "Certificate already exists at $CERT_DIR"
fi
