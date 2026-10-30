#!/bin/sh
# Sets up (or re-checks) the Cloudflare side of games.shirishve.com. Safe to run again: each step
# finds what already exists before creating anything.
#
#   1. the tunnel "doodle-games", configured from Cloudflare (no config file on the Air);
#   2. its token in 1Password, vault "Home server", item "cloudflare tunnel doodle-games"
#      (deploy/air/run-containers.sh reads it from there; it is never printed or written to disk);
#   3. its one route: games.shirishve.com -> http://doodle-games:2567, anything else -> 404;
#   4. DNS: games.shirishve.com -> the tunnel (proxied CNAME).
#
# Needs the Cloudflare API token in 1Password item "cloudfare token" (sic) with Zone DNS: Edit on
# shirishve.com and Account Cloudflare Tunnel: Edit. Run on the Air: sh deploy/air/cloudflare-tunnel.sh
set -eu
NAME=doodle-games
HOST=games.shirishve.com
ZONE=shirishve.com
SERVICE=http://doodle-games:2567
ITEM="cloudflare tunnel doodle-games"
OPH=$HOME/apps/living-room-tv/storage/op-home
B=https://api.cloudflare.com/client/v4

CF_TOKEN=$("$OPH" read "op://Home server/cloudfare token/credential" </dev/null)
api() { curl -sS -m 20 -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" "$@"; }
# read one value out of a Cloudflare JSON reply, failing loudly on an API error
jq_py() { /usr/bin/python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('success', True), d.get('errors'); r=d['result']; print($1)"; }

ZONE_JSON=$(api "$B/zones?name=$ZONE")
ACCOUNT=$(echo "$ZONE_JSON" | jq_py "r[0]['account']['id']")
ZONE_ID=$(echo "$ZONE_JSON" | jq_py "r[0]['id']")

# 1. the tunnel
TID=$(api "$B/accounts/$ACCOUNT/cfd_tunnel?name=$NAME&is_deleted=false" | jq_py "r[0]['id'] if r else ''")
if [ -z "$TID" ]; then
  TID=$(api -X POST "$B/accounts/$ACCOUNT/cfd_tunnel" --data "{\"name\":\"$NAME\",\"config_src\":\"cloudflare\"}" | jq_py "r['id']")
  echo "created tunnel $NAME ($TID)"
else
  echo "tunnel $NAME exists ($TID)"
fi

# 2. its token, straight into 1Password
if "$OPH" item get "$ITEM" --vault "Home server" </dev/null >/dev/null 2>&1; then
  echo "1Password item \"$ITEM\" exists"
else
  api "$B/accounts/$ACCOUNT/cfd_tunnel/$TID/token" | jq_py "r" | {
    read -r TUNNEL_TOKEN
    "$OPH" item create --vault "Home server" --category "API Credential" --title "$ITEM" \
      "credential=$TUNNEL_TOKEN" "hostname=$HOST" \
      "notesPlain=Cloudflare Tunnel $TID ($NAME). Read by doodle-games deploy/air/run-containers.sh." </dev/null >/dev/null
  }
  echo "saved the tunnel token to 1Password \"$ITEM\""
fi

# 3. the one route
api -X PUT "$B/accounts/$ACCOUNT/cfd_tunnel/$TID/configurations" \
  --data "{\"config\":{\"ingress\":[{\"hostname\":\"$HOST\",\"service\":\"$SERVICE\"},{\"service\":\"http_status:404\"}]}}" \
  | jq_py "'route: ' + ', '.join(i.get('hostname', '*') + ' -> ' + i['service'] for i in r['config']['ingress'])"

# 4. DNS
RECORD=$(api "$B/zones/$ZONE_ID/dns_records?name=$HOST" | jq_py "r[0]['id'] if r else ''")
DATA="{\"type\":\"CNAME\",\"name\":\"$HOST\",\"content\":\"$TID.cfargotunnel.com\",\"proxied\":true,\"comment\":\"Doodle Games: Cloudflare Tunnel $NAME\"}"
if [ -z "$RECORD" ]; then
  api -X POST "$B/zones/$ZONE_ID/dns_records" --data "$DATA" | jq_py "'dns: created ' + r['name']"
else
  api -X PUT "$B/zones/$ZONE_ID/dns_records/$RECORD" --data "$DATA" | jq_py "'dns: ' + r['name'] + ' -> ' + r['content']"
fi
