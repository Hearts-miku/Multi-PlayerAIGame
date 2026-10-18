#!/usr/bin/env bash
set -euo pipefail
# Ephemeral Redis on this runner only. No production credentials or insecure TLS.
cert_dir="${RUNNER_TEMP:?RUNNER_TEMP is required}/game-redis-tls"
mkdir -p "$cert_dir"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$cert_dir/server.key" -out "$cert_dir/server.crt" \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -addext 'basicConstraints=critical,CA:TRUE' 2>/dev/null
chmod 644 "$cert_dir/server.key" "$cert_dir/server.crt"
docker run --detach --name game-ci-redis --publish 127.0.0.1:6380:6379 \
  --mount "type=bind,src=$cert_dir,dst=/tls,readonly" \
  redis:7.4.7 redis-server --port 0 --tls-port 6379 \
  --tls-cert-file /tls/server.crt --tls-key-file /tls/server.key \
  --tls-ca-cert-file /tls/server.crt --tls-auth-clients no --save '' --appendonly no
for attempt in {1..30}; do
  if docker exec game-ci-redis redis-cli --tls --cacert /tls/server.crt -p 6379 ping | grep -qx PONG; then
    printf 'REDIS_URL=rediss://127.0.0.1:6380\nNODE_EXTRA_CA_CERTS=%s/server.crt\n' "$cert_dir" >> "$GITHUB_ENV"
    exit 0
  fi
  sleep 1
done
echo 'CI Redis failed to start' >&2
exit 1
