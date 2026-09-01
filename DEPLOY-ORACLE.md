# Deploying Nodpeak to Oracle Cloud Always Free

A complete, click-by-click and command-by-command walkthrough. Written for someone who has
just created an Oracle Cloud account and has never used OCI before.

**Time:** about 90 minutes the first time, most of it waiting.
**Cost:** $0, if you stay inside the limits below.

> **⚠️ Read this before you click anything.** Two facts break most of the Oracle guides you'll
> find online, and both will cost you real time if you learn them late:
>
> 1. **Oracle halved the Always Free ARM allowance in mid-2026** — from 4 OCPU / 24 GB down to
>    **2 OCPU / 12 GB total**, across every A1 instance in your account. Over-limit instances
>    were disabled starting August 2026 and are deleted 30 days later. Every blog post promising
>    "4 cores, 24 GB free forever" is stale. Source: [Oracle's Always Free Resources doc][free].
> 2. **Your home region is chosen at signup and can never be changed**, and free ARM capacity is
>    effectively region-bound. This is the single highest-stakes decision in the process, and it
>    happens before you've done anything else. §0 covers it.

[free]: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

---

## Contents

- [§0 Before you sign up — pick your home region](#0-before-you-sign-up--pick-your-home-region)
- [§1 Create the account](#1-create-the-account)
- [§2 Create the VM](#2-create-the-vm)
- [§3 If you hit "Out of host capacity"](#3-if-you-hit-out-of-host-capacity)
- [§4 Open ports 80 and 443 — firewall one of two](#4-open-ports-80-and-443--firewall-one-of-two)
- [§5 Point your domain at the box](#5-point-your-domain-at-the-box)
- [§6 Connect over SSH](#6-connect-over-ssh)
- [§7 Deploy Nodpeak](#7-deploy-nodpeak)
- [§8 Verify it actually works](#8-verify-it-actually-works)
- [§9 Backups](#9-backups)
- [§10 Updating](#10-updating)
- [§11 Failure modes, with fixes](#11-failure-modes-with-fixes)
- [§12 The standing rules for this box](#12-the-standing-rules-for-this-box)

---

## §0 Before you sign up — pick your home region

Your **home region is permanent**. Oracle's docs are explicit: *"You can't change this after
signing up."* And free ARM capacity is chronically exhausted in some regions and fine in others,
so the region you pick decides whether you can create a machine at all.

**What to do:**

1. Search `oracle cloud A1 out of capacity <region name>` for two or three candidate regions and
   read anything from the last few months. Community reports are all that exist — Oracle
   publishes no capacity data, so this is folklore, but it's the only signal available.
2. As of this writing, **US regions (Ashburn, Phoenix) are reported as more obtainable**;
   **Frankfurt, Amsterdam, Milan, Singapore, Mumbai, Hyderabad and Seoul are reported as
   chronically full**. Treat this as a starting point, not gospel — it shifts.
3. **Your buyers are in the US.** A US region is also the right latency choice. Ashburn
   (`us-ashburn-1`) is the default recommendation unless your capacity research says otherwise.

Do not pick the region nearest to you out of habit. You will almost never SSH in; your customers'
browsers will hit it constantly.

---

## §1 Create the account

1. Go to <https://www.oracle.com/cloud/free/> and click **Start for free**.
2. Fill in country, name, email. Verify the email.
3. **Choose your home region** — this is the irreversible step from §0.
4. **Add a credit or debit card.** This is mandatory even for the free tier; Oracle uses it for
   identity verification. Expect a small temporary authorization hold. Community reports
   consistently say **prepaid and virtual cards get rejected** — use a real card. Oracle does not
   document this, so treat it as likely rather than certain.
5. Accept and finish. You now have a 30-day trial with $300 of credit **plus** the Always Free
   resources, which continue after the trial ends.

**If signup is rejected with "Error Processing Transaction":** this is common and opaque. There
is no documented appeal path other than opening a support ticket. Try a different card before
assuming the account is the problem.

### Set a budget alert immediately

Do this before creating anything. It takes two minutes and it is the difference between a free
box and a surprise invoice.

1. Hamburger menu (☰) → **Billing & Cost Management** → **Budgets**
2. **Create Budget** → target your root compartment → monthly amount **$1**
3. Add an alert rule at **100% of actual spend**, with your email
4. **Create**

Anything that costs money now emails you the same day instead of at the end of the month.

---

## §2 Create the VM

1. ☰ → **Compute** → **Instances** → **Create instance**

2. **Name:** `nodpeak`

3. **Placement** — expand it. Note which **availability domain** you're in; you may need to
   change it in §3.

4. **Image and shape** → **Change image**
   - Select **Canonical Ubuntu**
   - Version **24.04** — and make sure the entry is the **aarch64** build, not x86
   - Do **not** pick "Minimal" — Oracle's own docs warn against Minimal Ubuntu on Arm shapes
   - **Select image**

5. **Change shape**
   - Shape series: **Ampere**
   - Shape name: **VM.Standard.A1.Flex**
   - **OCPUs: 1**, **Memory: 6 GB** for your first attempt
   - **Select shape**

   > Ask for **1 OCPU / 6 GB first**, not 2/12. Smaller requests succeed far more often when
   > capacity is tight, and you can resize upward later (Actions → Edit) without losing your data
   > or your IP. Nodpeak runs fine on 1/6; the build step is the only part that wants more.

6. **Networking**
   - Leave **Create new virtual cloud network** selected — it builds a working VCN, subnet,
     internet gateway and route table for you
   - **Subnet: Public subnet** — this matters, a private subnet has no public IP
   - **Assign a public IPv4 address: Yes**

7. **Add SSH keys**

   On your Mac, in Terminal:

   ```bash
   ssh-keygen -t ed25519 -C "nodpeak-oracle" -f ~/.ssh/nodpeak_oracle
   cat ~/.ssh/nodpeak_oracle.pub
   ```

   Copy the whole `ssh-ed25519 AAAA... nodpeak-oracle` line, choose **Paste public keys** in
   the console, and paste it.

   > Ed25519 is fine — the old "OCI needs RSA" advice is outdated. The real trap is pasting a
   > PuTTY `.ppk`; the console accepts it, the instance builds, and you simply can't log in.
   > OpenSSH format only.

8. **Boot volume** — check **Specify a custom boot volume size** and set **100 GB**.

   > Default is 50 GB and Docker fills it faster than you'd think. Your Always Free block storage
   > allowance is 200 GB total, so 100 GB is free — and growing it later means a console resize
   > *plus* `growpart` and `resize2fs` inside the OS. Do it now.

9. **Create.** Wait for the state to go orange **PROVISIONING** → green **RUNNING**, usually
   under two minutes.

10. **Copy the Public IP address** from the instance page. You need it for §5 and §6.

---

## §3 If you hit "Out of host capacity"

This is a real physical shortage in the free-tier pool, not something wrong with your account.
Work down this list in order:

1. **Ask for less.** 1 OCPU / 6 GB succeeds where 2/12 fails. If you were already at 1/6, try
   again anyway — capacity is released continuously.

2. **Change the availability domain explicitly.** Multi-AD regions (Ashburn, Phoenix, London,
   Frankfurt) have independent capacity pools. Open **Placement**, and try AD-1, AD-2 and AD-3
   one at a time rather than leaving it on automatic.

3. **Retry over hours, not seconds.** Capacity frees up as other people tear down. Try a few
   times an hour. There are community scripts that poll the API for you — Oracle has published no
   position on them, and hammering the API risks rate-limiting or an account flag, so if you use
   one, poll at minutes-apart intervals.

4. **Upgrade to Pay As You Go.** This is the workaround that actually works. PAYG accounts draw
   from the general capacity pool instead of the constrained free one, and Oracle confirms the
   free allowance survives the upgrade: *"Oracle doesn't charge for Always Free resources after
   you upgrade, and will only charge you for resource usage above the Always Free limits."*

   Two things to know before you do it:
   - A **~$100 verification hold** is widely reported. Oracle doesn't document it. It's a hold,
     not a charge, but the money is unavailable for a few days.
   - **The hard wall is gone.** On Always Free, exceeding a limit fails; on PAYG, exceeding a
     limit bills you. The $1 budget alert from §1 stops being a nicety and becomes essential.

---

## §4 Open ports 80 and 443 — firewall one of two

**Oracle has two independent firewalls and you must open both.** This is, by a wide margin, the
most common reason a correctly-deployed site is unreachable.

### 4a. The VCN Security List (in the console)

The default VCN allows inbound **TCP 22 only**. Everything else is dropped before it reaches
your machine.

1. ☰ → **Networking** → **Virtual Cloud Networks**
2. Click your VCN → in the left panel click **Subnets** → click your public subnet
3. Under **Security Lists**, click the **Default Security List**
4. **Add Ingress Rules**, and add these two:

   | Stateless | Source Type | Source CIDR | IP Protocol | Destination Port Range |
   |-----------|-------------|-------------|-------------|------------------------|
   | unchecked | CIDR        | `0.0.0.0/0` | TCP         | `80`                   |
   | unchecked | CIDR        | `0.0.0.0/0` | TCP         | `443`                  |

   Leave **Source Port Range** blank. Leave **Stateless** unchecked.

5. **Add Ingress Rules** to save.

### 4b. The OS firewall (on the machine)

Handled for you by `deploy.sh` in §7 — but you should understand what it does, because it's the
part people get wrong.

Oracle's Ubuntu images ship a locked-down `iptables` INPUT chain ending in:

```
REJECT all -- anywhere anywhere reject-with icmp-host-prohibited
```

Rules are evaluated top to bottom, so a rule **appended** with `-A` lands *after* that REJECT and
is silently ignored. You must **insert** with `-I`:

```bash
sudo iptables -I INPUT -m state --state NEW -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Check with `sudo iptables -L INPUT -n --line-numbers` — your ACCEPT lines must be **above** the
REJECT line.

**Do not install `ufw` on an OCI Ubuntu image.** Oracle's own developer blog explicitly
discourages it: it conflicts with the pre-installed iptables rules and can lock you out. And
**do not purge `iptables-persistent`** as some guides suggest — it works, but it also removes the
rule permitting link-local traffic to `169.254.0.2:3260`, which is the iSCSI path to your boot
volume. Break that and the instance won't boot.

> **A trap worth knowing:** Docker's published ports bypass the INPUT chain entirely — a
> container run with `-p 80:80` installs its own DNAT and FORWARD rules, so the packet is never
> "delivered locally" and never sees that REJECT. This means a containerised app can be reachable
> even with the INPUT chain untouched, which is why people conclude the iptables step is a myth.
> It isn't; it's bypassed on that one path. The inverse is the dangerous half: **any container
> bound to `0.0.0.0` is exposed to the internet the moment the security list opens, whatever your
> iptables says.** Nodpeak's compose file only publishes nginx's 80 and 443 for exactly this
> reason — the app container uses `expose`, not `ports`.

---

## §5 Point your domain at the box

Pick the hostname you'll serve from — `nodpeak.yourdomain.com`, or a fresh domain if this is
going to be the product's own home.

At your DNS provider:

| Type | Name         | Value             | TTL |
|------|--------------|-------------------|-----|
| A    | `nodpeak`  | *your public IP*  | 300 |

There is **no wildcard DNS** anywhere in your setup, so every hostname needs its own record.

Wait for it to resolve before going further — Let's Encrypt will fail if the name doesn't point
at the box yet:

```bash
dig +short nodpeak.yourdomain.com
```

That must print your Oracle public IP. If it prints nothing, wait and try again; TTL and
propagation can take a few minutes.

---

## §6 Connect over SSH

```bash
chmod 600 ~/.ssh/nodpeak_oracle
ssh -i ~/.ssh/nodpeak_oracle ubuntu@<YOUR_PUBLIC_IP>
```

The user is **`ubuntu`** on Ubuntu images (`opc` on Oracle Linux). There is no root login and no
password auth. `Permission denied (publickey)` almost always means the wrong username or the
wrong key file, not a broken key.

Optional but worth it — add to `~/.ssh/config` on your Mac:

```
Host nodpeak
  HostName <YOUR_PUBLIC_IP>
  User ubuntu
  IdentityFile ~/.ssh/nodpeak_oracle
```

Then it's just `ssh nodpeak`.

---

## §7 Deploy Nodpeak

All of this runs **on the Oracle box**, over SSH.

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<your-username>/nodpeak.git
cd nodpeak
cp .env.example .env
```

### Generate a real secret first

```bash
openssl rand -base64 48
```

Copy that output. Then `nano .env` and set these five. Everything else has a working default.

```ini
APP_URL=https://nodpeak.yourdomain.com
DOMAIN=nodpeak.yourdomain.com
CERTBOT_EMAIL=info@noumansadiq.com
AUTH_SECRET=<paste the openssl output here>
DEPLOYMENT_MODE=selfhost
```

`Ctrl+O`, `Enter`, `Ctrl+X` to save and exit.

> `deploy.sh` refuses to run if `DOMAIN` is still the placeholder or `AUTH_SECRET` is still
> `change-me`. That's deliberate — a predictable session secret means anyone can forge a login
> cookie.

### Run it

```bash
sudo ./deploy.sh
```

It takes 10–20 minutes on 1 OCPU, most of it the Docker build. In order, it will:

1. Update the system and install `git`, `ufw`, `openssl`, `iptables-persistent`
2. **Open ports 80 and 443** in `iptables` and save them — *before* Docker is installed, so
   Docker's own generated chains never get snapshotted into `rules.v4`
3. Install Docker Engine and the Compose plugin from Docker's official repo
4. Add 4 GB of swap — OCI images ship with none, and `next build` is the one step that can spike
   into the OOM killer
5. Write a throwaway self-signed certificate, because nginx won't start without one and certbot
   needs nginx running to answer the ACME challenge
6. Build the images and start the stack
7. Request the real Let's Encrypt certificate and reload nginx
8. Print your URLs

When it finishes you'll see the summary block with your dashboard, register, widget and health
URLs.

---

## §8 Verify it actually works

Do not skip this. A green deploy script is not a working product.

**From the box:**

```bash
docker compose ps                    # all three services "Up", app "healthy"
curl -s localhost/api/health         # {"ok":true,...,"db":"up",...}
```

**From your Mac:**

```bash
curl -sI https://nodpeak.yourdomain.com/widget.js | head -5
```

You want `HTTP/2 200`, `content-type: application/javascript`, and
`access-control-allow-origin: *`.

**Then, in a real browser** — and this is the part that matters:

1. Open `https://nodpeak.yourdomain.com/register` and create your account
2. Add a project with a real domain
3. Go to **Widgets**, copy the HTML snippet
4. Paste it into a real page on a real site and load that page **in a browser, not curl**
5. Click the bubble, leave a 5-star review, and confirm the Google hand-off appears
6. Check it landed in **Reviews** in the dashboard

> You already know why step 4 is in bold. The teardown form passed every `curl` test for weeks
> and had never once worked from a browser, because curl doesn't send a CORS preflight. Test the
> customer's path the customer's way.

Also confirm the certificate is real, not the bootstrap one:

```bash
echo | openssl s_client -connect nodpeak.yourdomain.com:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Issuer should say Let's Encrypt. If it says `CN=nodpeak.yourdomain.com`, certbot didn't
succeed — see §11.

---

## §9 Backups

**Nothing on this box is durable by default.** Your entire database is one SQLite file in a
Docker volume, and Oracle gives you no automatic backups.

### The five-second manual backup

```bash
cd ~/nodpeak
docker run --rm -v nodpeak_data:/data -v $PWD:/out alpine \
  tar czf /out/nodpeak-$(date +%F).tar.gz -C /data .
```

### Automatic off-box backups — do this properly

The repo ships Litestream, which streams the SQLite file continuously to any S3-compatible
bucket. Cloudflare R2 has a generous free tier and no egress charges.

1. Create an R2 bucket and an API token at dash.cloudflare.com
2. In `.env` on the box:

   ```ini
   LITESTREAM_ENABLED=true
   LITESTREAM_BUCKET=nodpeak-backups
   LITESTREAM_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
   LITESTREAM_REGION=auto
   LITESTREAM_ACCESS_KEY_ID=<token id>
   LITESTREAM_SECRET_ACCESS_KEY=<token secret>
   ```
3. `docker compose up -d --force-recreate app`
4. `docker compose logs app | grep -i litestream` — you want to see it replicating

**A backup you have never restored is not a backup.** Once it's running, prove it: destroy the
volume on a *second* throwaway instance and confirm the entrypoint's `litestream restore` brings
the database back.

---

## §10 Updating

```bash
cd ~/nodpeak
git pull
docker compose build
docker compose up -d
docker compose logs -f app
```

The entrypoint runs `prisma db push` on every start, so schema changes apply themselves. Take a
backup first anyway — `db push` on SQLite can drop a column if the schema moved under it.

Certificate renewal is automatic: the certbot container wakes every 12 hours and renews anything
inside 30 days of expiry.

---

## §11 Failure modes, with fixes

**Site unreachable, times out**
You did one firewall, not both. `sudo ss -tlnp | grep -E ':(80|443)'` on the box — if nginx is
listening but the outside world times out, it's the VCN security list (§4a). Recheck that the
rules saved.

**Site unreachable, "connection refused"**
Nothing is listening, or it's bound to localhost only. `docker compose ps` and
`docker compose logs nginx`.

**`certbot failed` in the deploy output**
Almost always DNS. `dig +short nodpeak.yourdomain.com` must return your Oracle IP *before*
certbot runs. Fix DNS, wait for propagation, then:

```bash
cd ~/nodpeak
docker run --rm -v nodpeak_certbot_conf:/etc/letsencrypt \
  -v nodpeak_certbot_www:/var/www/certbot certbot/certbot certonly \
  --webroot -w /var/www/certbot --email <you> --agree-tos --no-eff-email \
  --force-renewal -d nodpeak.yourdomain.com
docker compose restart nginx
```

Let's Encrypt rate-limits to **5 failures per hostname per hour**. If you've been retrying, wait
an hour rather than burning more attempts.

**Container exits with code 137 during build**
Out of memory. Confirm swap exists with `swapon --show`. If `deploy.sh` skipped it, add it by
hand (§7 step 4). On 1 OCPU / 6 GB, run `docker compose build` on its own and let it take its time.

**`no matching manifest for linux/arm64/v8`**
An image in your stack has no ARM build. Every image Nodpeak uses (node, nginx, certbot,
alpine) is multi-arch, so this only appears if you've added something. Check with
`docker manifest inspect <image>`. **Never "fix" it with `--platform linux/amd64`** — there's no
emulation layer installed and it will either fail or crawl.

**Boot volume full**
`df -h /` then `docker system prune -af --volumes`. Note that `--volumes` will delete your
database volume if the stack is down — bring the stack up first, or drop `--volumes`.

**Instance suddenly disabled by Oracle**
Two possible causes. Over the 2 OCPU / 12 GB limit — resize down and open a support ticket to
re-enable. Or idle reclamation: Oracle stops instances where CPU, network **and** memory all sit
under 20% for a 7-day stretch. A live site never trips this; a parked one does. Note the
enforcement in August 2026 caught at least one account that was already compliant, so a support
ticket is a legitimate response even if you've done nothing wrong.

**Everything worked, then stopped after a reboot**
Check `sudo iptables -L INPUT -n --line-numbers` — if your ACCEPT rules are gone,
`netfilter-persistent save` didn't run. Re-add and re-save.

---

## §12 The standing rules for this box

- **Never `docker compose down -v`.** The `-v` deletes named volumes, and your database is one.
- **Take a backup before every `git pull`.**
- **Never edit files directly on the box** except `.env`. Everything else changes in git and
  arrives via `git pull`, or the next deploy silently reverts it.
- **`.env` is never committed.** It holds `AUTH_SECRET` and, once billing is live, your webhook
  secret.
- **Treat this box as disposable.** Account terminations without warning are reported often
  enough to plan around. The off-box backup in §9 is what makes that survivable.
- **Rotating `AUTH_SECRET` signs out every user.** It's the emergency lever, not routine hygiene.
- **Stay at or under 2 OCPU / 12 GB in total, permanently.** Not per instance — in total.

---

## Sources

- [Always Free Resources — Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Always Free resource reference — Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
- [Platform Images — Oracle docs](https://docs.oracle.com/en-us/iaas/Content/Compute/References/images.htm)
- [Security Lists — Oracle docs](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm)
- [Managing Key Pairs on Linux Instances — Oracle docs](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/managingkeypairs.htm)
- [Enabling Network Traffic to Ubuntu Images in OCI — Oracle developer blog](https://blogs.oracle.com/developers/enabling-network-traffic-to-ubuntu-images-in-oracle-cloud-infrastructure)
- [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- [Oracle Quietly Halves Free Tier Ampere A1 Compute Limits — InfoQ](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- [A1 instance disabled despite being within the new limit — Oracle Cloud Customer Connect](https://community.oracle.com/customerconnect/discussion/974476/always-free-a1-instance-disabled-despite-being-within-new-2-ocpu-12-gb-limit)
