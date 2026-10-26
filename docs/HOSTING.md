# Hosting — the MacBook Air

Today this serves Snakes & Ladders (`games/snakes-and-ladders`). Each new game gets its own server
and port until they share one; record it here.

Goal: the owner's spare MacBook Air serves the game at **https://games.shirishve.com**, with online
play. This file is the brief for the agent doing that setup on the Air. The domain and DNS live in
the owner's **personal** AWS account. Ask the owner for access; never use a work account or work
credentials.

## What runs

One process serves everything on one port (default 2567):

- the built web client (`apps/web/dist`), with `/join/CODE` and every other unknown path answered
  with `index.html`;
- the Colyseus matchmaking routes (`/matchmake/...`) and the game WebSockets;
- `GET /__healthcheck` → `OK`.

It keeps rooms in memory: a restart ends the games in progress, and nothing else is lost (there is
no database). One process is enough for this. Colyseus only needs sticky sessions with more than
one process, so they do not matter here.

## The Air today (checked 2026-10-24 over SSH from the M1 Max)

`ssh -i ~/.ssh/id_ed25519_air shrshk7@Shirishs-M2.local` works from the M1 Max. The Air is arm64
on macOS 27.0.1 with git, but no Node, Docker or Homebrew. The quickest runtime with no admin
password is Node 22 from the official arm64 tarball, unpacked into `~/.local/node`, with
`corepack enable` for pnpm. Docker Desktop or Homebrew need the owner's admin password.

## 1. Get it running on the Air

```sh
git clone https://github.com/shrshk/doodle-games.git && cd doodle-games
```

Pick one:

- **Docker** (Docker Desktop, OrbStack or colima):
  `docker build -t snakes-doodle . && docker run -d --name snakes --restart unless-stopped -p 127.0.0.1:2567:2567 snakes-doodle`
- **Plain Node 22** (pnpm via `corepack enable`):
  `pnpm install --frozen-lockfile && pnpm build && PORT=2567 HOST=127.0.0.1 pnpm start`,
  kept alive by a launchd agent (`~/Library/LaunchAgents/com.shirishve.snakes.plist` with
  `KeepAlive`, `RunAtLoad`, `WorkingDirectory` set to the clone, and `ProgramArguments` running
  `node games/snakes-and-ladders/apps/server/dist/index.js`). Use the absolute path to `node`, because launchd has no shell PATH.

Check: `curl http://127.0.0.1:2567/__healthcheck` prints `OK`, and http://127.0.0.1:2567 shows the game.

Bind to 127.0.0.1 when a tunnel or reverse proxy sits in front. Bind to 0.0.0.0 only for testing on
the LAN (`http://<air-name>.local:2567`).

Keep the Air awake: the launchd agent wraps the server in `caffeinate -is` (no admin needed; see
"Set up" below). `sudo pmset -c sleep 0 disksleep 0` is the admin alternative. With the lid closed,
macOS sleeps unless it is on power with an external display connected.

## 2. Put it on games.shirishve.com

Check first, and write down what you find:

1. Is `shirishve.com` registered, and is its DNS hosted in Route 53 in the personal account?
   (`aws route53 list-hosted-zones` with the owner's personal profile.)
2. Can the home router forward a port? If the ISP uses CGNAT, the router's WAN address will not
   match `curl ifconfig.me`. In that case, inbound port forwarding cannot work.

Then pick one path:

**A. Cloudflare Tunnel (works behind CGNAT, no open ports).** `cloudflared` on the Air makes an
outbound tunnel. Cloudflare terminates TLS and passes WebSockets through. The catch: the hostname
must be in a Cloudflare zone. Keeping DNS in Route 53 means either moving the zone's nameservers to
Cloudflare (free plan) or delegating a subdomain. The owner wants to stay on AWS, so ask before you
move DNS.

**B. Port forward + Caddy + Route 53 (stays on AWS; needs a forwardable port).** Forward 80 and 443
on the router to the Air. Run Caddy with:

```
games.shirishve.com {
    reverse_proxy 127.0.0.1:2567
}
```

Caddy gets and renews the Let's Encrypt certificate and proxies WebSockets without extra
configuration. Point an `A` record for `games.shirishve.com` at the home IP. Home IPs change, so add
a small launchd job that compares `curl ifconfig.me` with the record and UPSERTs it through
`aws route53 change-resource-record-sets` when they differ. Give it its own IAM user, limited to
`route53:ChangeResourceRecordSets` on that one hosted zone and `route53:ListResourceRecordSets`.

**C. Tailscale Funnel** is the quickest, but it serves only `*.ts.net` names, not the custom domain.
It is fine as a stopgap.

**About the certificate.** A normal AWS Certificate Manager (ACM) certificate cannot be installed on
the Air: ACM certificates attach to AWS services (CloudFront, load balancers), and the private key
never leaves AWS. ACM's *exportable* public certificates (2025) can be exported, but they cost per
domain name and must be exported again on every renewal. Prefer Let's Encrypt through Caddy (path
B): free, and it renews by itself. With path A, Cloudflare provides the certificate.

The page needs HTTPS for the PWA install and the service worker. The game client connects to the
same origin it was loaded from, so no client configuration is needed for any of these paths.

## 3. Verify

- `curl -sf https://games.shirishve.com/__healthcheck` prints `OK`.
- Two devices on different networks (a phone on mobile data plus a laptop): one starts a room, the
  other opens the share link, and they play a few turns.
- Turn the phone's network off for 30 s mid-game, then on again: the player rejoins their seat.
- Restart the service (`docker restart snakes`, or `launchctl kickstart -k gui/$UID/com.shirishve.snakes`):
  the page comes back by itself.

## Set up (done 2026-10-24)

Node 22.20.0 in `~/.local/node`, the repo in `~/apps/doodle-games`, and the launchd agent
`~/Library/LaunchAgents/com.shirishve.snakes.plist` (runs `/usr/bin/caffeinate -is node
games/snakes-and-ladders/apps/server/dist/index.js` on 0.0.0.0:2567, KeepAlive, logs to `~/Library/Logs/snakes-doodle.log`).
On the LAN: `http://shirishs-m2.local:2567`.

`caffeinate -is` keeps the Air awake for as long as the server runs, with no admin password. Without
it the Air went into "Maintenance Sleep" a minute after going idle and woke only ~10 s at a time for
network traffic: a phone got the page in one wake and the script never arrived (a blank white
screen). Check with `pmset -g assertions` (a caffeinate line naming the node process). With the lid
closed macOS still sleeps unless it is on power with an external display; `sudo pmset -c sleep 0`
(admin) also stops the idle sleep for good.

Update from the M1 Max in one go:

```sh
ssh -i ~/.ssh/id_ed25519_air shrshk7@Shirishs-M2.local 'export PATH=$HOME/.local/node/bin:$PATH; cd ~/apps/doodle-games && git pull -q && pnpm install --frozen-lockfile && pnpm build && launchctl kickstart -k gui/$(id -u)/com.shirishve.snakes'
```

## 4. Updating

`git pull`, then rebuild and restart: `docker build ... && docker rm -f snakes && docker run ...`,
or `pnpm install --frozen-lockfile && pnpm build` and a launchd kickstart. Bump `VERSION` in
`apps/web/public/sw.js` whenever its caching rules change. Otherwise, installed PWAs pick up new
builds on their next network-first page load.

## Cost and safety notes

- The Air costs nothing to run beyond power. Route 53 costs $0.50 a month per hosted zone plus the
  domain renewal. Cloudflare Tunnel's free plan covers this.
- The server accepts anonymous players by design: rooms are private by code, and the server never
  trusts a client's dice or positions. Rate limits: one roll per 300 ms per client. Nothing else
  needs protecting, because there are no accounts and no stored data.
- If it ever moves to AWS proper: the same image runs on Lightsail containers or ECS behind an
  ALB. Turn on stickiness only if you run more than one task.
