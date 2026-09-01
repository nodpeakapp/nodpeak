# Nodpeak — go live

**Target: live at `https://app.nodpeak.com` on the existing Coolify VPS.**
One evening of work, most of it waiting for a build.

This is the plan for *your* production instance. It is separate from
[`DEPLOY-ORACLE.md`](DEPLOY-ORACLE.md), which stays in the repo as the runbook other people
follow to self-host — and which you'll use later for the public demo box.

---

## Why the VPS and not Oracle

Oracle free tier was the plan until the moment Nodpeak became a prerequisite for the Polar
application. Free ARM capacity is a lottery that can block you for days, the allowance was halved
in mid-2026, and Oracle disabled instances in August — including at least one that was already
inside the new limit. That is an acceptable risk for a demo box and an unacceptable one for a
revenue dependency.

`212.56.45.73` is live, verified, and already solves proxy, TLS and DNS. Use it.

**Oracle still gets a job**: the public demo instance at `demo.nodpeak.…`, reset nightly. If
Oracle kills it you lose a demo, not customer data — and running the demo on a free ARM box proves
the README's claim honestly, which is worth something on Show HN.

---

## About the traffic

Measured on 2 vCPU, which is the same size as an Oracle A1 box and a fair proxy for a slice of the
VPS:

| Endpoint | Throughput | p50 | p95 |
|---|---|---|---|
| `/api/v1/widget-config/:id` | **524 req/s** | 83 ms | 157 ms |
| `/widget.js` | 844 req/s | 50 ms | 118 ms |
| `/api/health` (SQLite every call) | 606 req/s | 75 ms | 120 ms |

Conservative — the load generator was competing for the same two cores.

**The load that scales is not visitors to your site.** It's `widget-config`, called once per page
view on every customer site running the embed. That endpoint now has an in-process 60-second cache
in front of it, so it costs one SQLite read per project per minute no matter how much traffic the
customer's site gets. 100,000 page views spread over a day is about 1.2 req/s average — under 2%
of measured capacity even at a peak ten times the average.

**What would actually break first**, in order, if volume ever got extreme: the single Node process
saturating before SQLite does; then concurrent *writes* if a very large number of people submitted
feedback at the same moment (reads are fine — WAL is now on, so readers never block the writer);
then the in-process rate limiter, which is per-container and loosens if you ever run replicas.
None of these are near.

**And the honest part:** a front-page Show HN is on the order of 5,000–30,000 visitors with a
24-hour half-life. Hundreds of thousands is not the shape of a solo open-source launch. That isn't
pessimism — plan for the real number and the box is comfortable either way.

**The thing that actually needed solving was not Nodpeak's load. It was Nodpeak's load landing
on the engine.** That is now handled mechanically rather than by hope: the container has a hard
ceiling of 1 CPU and 1 GB. It physically cannot starve the engine, whatever happens to it.

---

## Step 0 — check the box has room (do this first)

I can't SSH to the VPS from here, so I don't know its specs. Run this and tell me the output:

```bash
echo "--- cpu/mem ---"; nproc; free -h
echo "--- disk ---";    df -h /
echo "--- docker ---";  docker ps --format 'table {{.Names}}\t{{.Status}}'
echo "--- usage ---";   docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
```

**What I'm looking for:** at least 2 GB of memory free and 10 GB of disk. If the box is already
tight, we put Nodpeak on its own $5 VPS instead — cheaper than degrading the engine.

---

## Step 1 — repo onto GitHub

Neither the cloud container nor `device_bash` can reach GitHub, so the actual push is yours to
run. `nodpeak/` is written into the Outreach folder already git-initialized with a first commit
in place — the code, not the old `openproof/` snapshot next to it.

Then, on github.com: create a repository named `nodpeak` under a **new organisation** rather
than your personal account — an org reads as a project, a personal repo reads as a side project.
**Public from the start**, per your call — no private staging period.

```bash
cd ~/Documents/Outreach/nodpeak
git remote add origin git@github.com:nodpeakapp/nodpeak.git
git push -u origin main
git tag v0.1.0 && git push origin v0.1.0
```

> **Tag `v0.1.0` now.** `awesome-selfhosted` rejects any project whose first tagged release is
> under four months old, and that list feeds both human and LLM discovery. The clock starts at the
> tag, not at the launch.

---

## Step 2 — DNS

One A record at your DNS provider:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `app` | `212.56.45.73` | 300 |

There is no wildcard DNS on that box, so this record is mandatory. Confirm before going further:

```bash
dig +short app.nodpeak.com     # must print 212.56.45.73
```

**On the domain choice:** `app.nodpeak.com`, a subdomain of the domain you already own — not a
new one. One A record, no extra cost. Matches the rebrand instead of leaving the product live
under a personal-domain URL from before it had a name.

---

## Step 3 — Coolify

1. **New Resource → Docker Compose**, pointed at the `nodpeak` repo, branch `main`
2. **Compose file: `docker-compose.coolify.yml`** — not `docker-compose.yml`. The Coolify variant
   drops nginx and certbot, because Coolify's own proxy already terminates TLS. Running both would
   fight over ports 80 and 443.
3. **Put it in its own Coolify project**, not alongside the engine. Coolify gives each project its
   own Docker network, which keeps Nodpeak off the engine's network — worth doing, because
   Nodpeak's audit endpoint fetches URLs strangers supply and the engine holds client snapshots
   and the signed authorisation chain.
4. **Domain:** `https://app.nodpeak.com`. Let Coolify issue the certificate.
5. **Environment variables** — generate the secret first, on the box:

   ```bash
   openssl rand -base64 48
   ```

   ```ini
   APP_URL=https://app.nodpeak.com
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=file:/data/nodpeak.db
   AUTH_SECRET=<the openssl output>
   SESSION_TTL_DAYS=30
   DEPLOYMENT_MODE=selfhost
   ALLOW_REGISTRATION=true
   ```

   > **Do not paste `#` comments into Coolify's bulk environment editor.** Same trap as zsh — the
   > `#` and everything after it arrive as part of the value.

   Leave `PAYMENT_WEBHOOK_SECRET` unset for now. The webhook fails closed with a 503 when it has
   no secret, which is exactly right until billing is real.

6. **Deploy.** First build is 10–20 minutes; the Next build is most of it.

7. **After your account exists, set `ALLOW_REGISTRATION=false` and redeploy.** Otherwise the
   internet can sign up on your instance.

---

## Step 4 — verify, the customer's way

```bash
curl -s https://app.nodpeak.com/api/health
curl -sI https://app.nodpeak.com/widget.js | head -5
```

Health must report `"db":"up"`. The widget must return `200`, `application/javascript`, and
`access-control-allow-origin: *`.

Then, **in a browser**:

1. `/register` — create your account
2. Add a project for `noumansadiq.com`
3. **Widgets** → copy the HTML snippet
4. Paste it into a real page on `noumansadiq.com` and load that page **in a browser**
5. Click the bubble, leave 5 stars, confirm the Google hand-off appears
6. Confirm it landed in **Reviews**
7. Approve it, and confirm the JSON-LD appears in the page source

> Step 4 is the one that matters. The teardown form passed every `curl` test for weeks and had
> never once worked from a browser, because curl doesn't send a CORS preflight. `curl` is not the
> customer.

Then confirm the resource ceiling is actually applied:

```bash
docker stats --no-stream | grep -i nodpeak   # LIMIT column should read 1GiB
```

---

## Step 5 — backups, before there is anything to lose

The whole database is one SQLite file in a Docker volume. Coolify's scheduled backups do not touch
it — you already learned that with the engine.

Create a Cloudflare R2 bucket and an API token, then add to the Coolify environment:

```ini
LITESTREAM_ENABLED=true
LITESTREAM_BUCKET=nodpeak-backups
LITESTREAM_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
LITESTREAM_REGION=auto
LITESTREAM_ACCESS_KEY_ID=<token id>
LITESTREAM_SECRET_ACCESS_KEY=<token secret>
```

Redeploy, then `docker compose logs app | grep -i litestream` to confirm it's replicating.

**Then restore it once, onto a throwaway container, and confirm the data comes back.** A backup
you have never restored is not a backup.

---

## Step 6 — only now, Polar

With the product live at its own URL:

1. Finish the Polar onboarding with the **software-only** description
2. Push through Stripe Connect identity and payout setup — **this is the actual test**
3. If approved: create a $1 product, buy it with your own card, and watch it to a **settled
   payout**. An approved dashboard is a claim; money in the account is evidence.
4. Only then wire the webhook: set `PAYMENT_WEBHOOK_SECRET`, `DEPLOYMENT_MODE=cloud`,
   `PAYMENT_PROVIDERS=polar`, and add the `polar` case to `normalize()` — about fifteen lines
   alongside the Lemon Squeezy and Paddle shapes already there.

---

## What changed in the code for this

- **`apps/web/src/lib/response-cache.ts`** — new. 60-second in-process cache for `widget-config`,
  so the hot endpoint costs one SQLite read per project per minute regardless of what proxy sits
  in front. Invalidated on every write that changes what the widget returns: approving or deleting
  a review, saving widget config, editing the project.
- **`apps/web/src/lib/db.ts`** — SQLite now runs in **WAL** mode with a 5-second busy timeout, so
  readers never block the writer. *Found while building: `PRAGMA journal_mode` returns a row, and
  Prisma rejects that on `$executeRaw` — it has to be `$queryRaw`. Verified by reading the pragma
  back, not by the absence of an error.*
- **`docker-compose.coolify.yml`** — new. App only, no nginx, no certbot, hard limits of 1 CPU and
  1 GB, log rotation.
- **`docker-compose.yml`** — resource limits and log rotation added to the standalone stack too.

---

## The standing rules for this instance

- **Never `docker compose down -v`.** `-v` deletes the volume, and the volume is the database.
- **Back up before every deploy.** The entrypoint runs `prisma db push` on start, and `db push`
  on SQLite can drop a column if the schema moved under it.
- **`.env` never gets committed.** It holds `AUTH_SECRET` and, later, the webhook secret.
- **Rotating `AUTH_SECRET` signs out every user.** Emergency lever, not routine hygiene.
- **Raise the resource limits only deliberately**, and only after checking what the engine needs
  first. The engine is the revenue; Nodpeak is the bet.
