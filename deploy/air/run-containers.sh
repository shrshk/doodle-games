#!/bin/sh
# Runs Doodle Games on the Air (Colima) with the game sealed off from the Mac, the LAN and the internet.
#
#   doodle-games          the game; ONLY on doodle-games-internal, a Docker "internal" network with no
#                         route out (no Mac services, no LAN, no Tailscale, no internet) and no
#                         published port. An attacker who took over the game process reaches nothing.
#   doodle-games-tunnel   cloudflared, the only way in: on doodle-games-internal (to reach the game)
#                         and doodle-games-egress (its outbound link to Cloudflare). Cloudflare routes
#                         games.shirishve.com -> http://doodle-games:2567 and nothing else.
#
# Both run as non-root, read-only, all capabilities dropped, no-new-privileges, with memory and process
# limits. The tunnel token is read from 1Password ("Home server" vault) at start, never written to disk.
#
# Usage, on the Air:  deploy/air/run-containers.sh <image tag>   e.g. 5dee673 (built from that commit)
set -eu
TAG=${1:?usage: run-containers.sh <doodle-games image tag>}
CLOUDFLARED=cloudflare/cloudflared:2026.10.1
OPH=$HOME/apps/living-room-tv/storage/op-home

export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
# ~/.docker/config.json names a credential helper this Mac does not have; an empty config avoids it
DOCKER_CONFIG=$(mktemp -d)
echo '{}' > "$DOCKER_CONFIG/config.json"
export DOCKER_CONFIG
PATH=/opt/homebrew/bin:$PATH

network() { docker network inspect "$1" >/dev/null 2>&1 || docker network create "$@" >/dev/null; }
# A fixed bridge name, so the Colima VM's firewall can drop everything this network sends to the VM
# itself (its SSH would otherwise answer the game): see "provision" in ~/.colima/default/colima.yaml.
network doodle-games-internal --internal -o com.docker.network.bridge.name=br-doodle-int
network doodle-games-egress

docker rm -f doodle-games doodle-games-tunnel >/dev/null 2>&1 || true

docker run -d --name doodle-games --restart unless-stopped \
  --network doodle-games-internal \
  --read-only --tmpfs /tmp:size=16m --user node \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 384m --memory-swap 768m --pids-limit 128 \
  "doodle-games:$TAG" >/dev/null

TUNNEL_TOKEN=$("$OPH" read "op://Home server/cloudflare tunnel doodle-games/credential" </dev/null) \
docker create --name doodle-games-tunnel --restart unless-stopped \
  --network doodle-games-internal \
  --read-only --user 65532:65532 \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --pids-limit 64 -e TUNNEL_TOKEN \
  "$CLOUDFLARED" tunnel --no-autoupdate --metrics 127.0.0.1:2000 run >/dev/null
docker network connect doodle-games-egress doodle-games-tunnel
docker start doodle-games-tunnel >/dev/null

docker ps --filter name=doodle-games --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
