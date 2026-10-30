# Hosting — the MacBook Air

The owner's MacBook Air serves the games at **https://games.shirishve.com** (Snakes & Ladders today).
The Air also runs the owner's private home apps; the games are the one thing on it that the internet
can reach, so the setup below is built to keep an attacker who gets into the game from going further.

## What runs

One process serves everything on port 2567: the built web client (`/join/CODE` and other page paths
answered with `index.html`, missing files with 404), the Colyseus matchmaking routes and game
WebSockets, and `GET /__healthcheck` → `OK`. Rooms live in memory: a restart ends the games in
progress and loses nothing else (no database, no accounts).

## Set up (2026-10-30)

```
phone / browser ── https ──> Cloudflare (DNS, TLS, DDoS) ── tunnel ──> doodle-games-tunnel ──> doodle-games:2567
                                                                   (only way in)          (no way out)
```

- **Domain:** `shirishve.com`, registered and hosted at Cloudflare. `games.shirishve.com` is a
  proxied CNAME to the Cloudflare Tunnel `doodle-games` (id `94bd5587-e639-4a08-a0fd-ef35755437ec`),
  configured from Cloudflare with one route, `games.shirishve.com` → `http://doodle-games:2567`, and
  a 404 for everything else. No router port is open; the tunnel connects outbound.
- **Containers** (Colima on the Air), started by [`deploy/air/run-containers.sh`](../deploy/air/run-containers.sh):
  - `doodle-games`, image `doodle-games:<commit>` built from this repo's `Dockerfile`. Only on
    `doodle-games-internal`, a Docker *internal* network: no route to the Mac's own services (which
    Colima otherwise makes reachable), the LAN, Tailscale or the internet, and no published port.
  - `doodle-games-tunnel`, `cloudflare/cloudflared` pinned to a release at least two weeks old. On
    `doodle-games-internal` (to reach the game) and `doodle-games-egress` (its link to Cloudflare).
  - Both: non-root, read-only filesystem, all capabilities dropped, no-new-privileges, memory and
    process limits, `--restart unless-stopped`, no host folders mounted.
- **Secrets:** the tunnel token is in 1Password, vault "Home server", item
  `cloudflare tunnel doodle-games`, read at container start through
  `~/apps/living-room-tv/storage/op-home` (a service account that sees only that vault). The
  Cloudflare API token (item `cloudfare token`) can edit DNS on `shirishve.com` and Cloudflare Tunnels.
- **Abuse limits** in the game server: 30 room creations/joins per address per minute (it reads
  Cloudflare's `CF-Connecting-IP`), 200 open rooms, 20 messages per client per second.

Why the internal network: on 2026-10-30, from inside the game container on an ordinary bridge
network, the Mac's local-only services (the photos app, mimir-flix, Caddy, SSH), the router and the
internet all accepted connections, and two of those apps answer without a login. With the game on the
internal network, check the opposite holds after any change:

```sh
docker exec doodle-games node -e "require('net').connect({host:'host.lima.internal',port:22,timeout:2000}).on('connect',()=>console.log('REACHABLE - fix this')).on('error',e=>console.log('blocked:',e.code)).on('timeout',()=>console.log('blocked: timeout'))"
```

There is no LAN address for the games any more (no `:2567` on the LAN, no `games.home` name): at home
and away, everyone uses https://games.shirishve.com.

## Deploying a new version

On the Air (`ssh -i ~/.ssh/id_ed25519_air shrshk7@Shirishs-M2.local`):

```sh
cd ~/apps/doodle-games && git pull -q
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock DOCKER_CONFIG=$(mktemp -d); echo '{}' > $DOCKER_CONFIG/config.json
docker build -t doodle-games:$(git rev-parse --short HEAD) .
sh deploy/air/run-containers.sh $(git rev-parse --short HEAD)
```

Then check `curl -sf https://games.shirishve.com/__healthcheck`, and open a room from two devices.
Bump `VERSION` in `apps/web/public/sw.js` when its caching rules change; otherwise installed PWAs pick
up a new build on their next page load.

## Keeping the Air awake

A sleeping Air takes the games offline (earlier it went into "Maintenance Sleep" a minute after
going idle). With the lid closed macOS sleeps unless it is on power with an external display;
`sudo pmset -c sleep 0` (admin) stops idle sleep.

## Cost

The domain is about $10 a year at Cloudflare; DNS, the tunnel and TLS are on Cloudflare's free plan.
If the games ever move to AWS, the same image runs on Lightsail containers or ECS.
