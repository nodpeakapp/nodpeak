#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Nodpeak — one-shot deploy for a fresh Ubuntu 22.04/24.04 box
#  Tested on Oracle Cloud Ampere A1 (arm64) and generic x86_64 VPS.
#
#    git clone https://github.com/<you>/nodpeak.git
#    cd nodpeak && cp .env.example .env && nano .env
#    sudo ./deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[1;33m'; NC=$'\033[0m'
log()  { echo "${GRN}==>${NC} $*"; }
warn() { echo "${YLW}==>${NC} $*"; }
die()  { echo "${RED}!!!${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root:  sudo ./deploy.sh"

cd "$(dirname "$0")"
[[ -f .env ]] || die ".env not found. Run: cp .env.example .env && nano .env"
set -a; . ./.env; set +a

: "${DOMAIN:?DOMAIN must be set in .env}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env}"
[[ "$DOMAIN" == "nodpeak.example.com" ]] && die "DOMAIN is still the placeholder. Edit .env."
[[ "${AUTH_SECRET:-}" == "change-me-openssl-rand-base64-48" || -z "${AUTH_SECRET:-}" ]] \
  && die "AUTH_SECRET is unset or still the placeholder. Run: openssl rand -base64 48"

# ── 1. System packages ───────────────────────────────────────
log "updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release git ufw openssl iptables-persistent

# ── 2. Firewall — ports 80 and 443 ───────────────────────────
# Oracle Cloud images ship a locked-down iptables INPUT chain that
# ufw alone does not clear, so both are handled.
# Deliberately BEFORE Docker. `netfilter-persistent save` snapshots whatever
# is in the tables at that moment, and Docker generates its own chains at
# install time — saving them into rules.v4 can fight Docker's own rule
# management across a reboot. Write our rules to disk first, then install Docker.
log "opening ports 80 and 443"
iptables -I INPUT 1 -p tcp --dport 80  -m conntrack --ctstate NEW -j ACCEPT
iptables -I INPUT 1 -p tcp --dport 443 -m conntrack --ctstate NEW -j ACCEPT
netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4 || true

ufw allow 22/tcp  >/dev/null 2>&1 || true
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

warn "Oracle Cloud users: also open 80/443 in the VCN Security List / NSG in the console."

# ── 3. Docker ────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker Engine + Compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io \
                     docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed — skipping"
fi


# ── 3b. Swap ─────────────────────────────────────────────────
# OCI platform images ship with no swap at all. 12 GB is normally plenty, but
# `next build` inside Docker is the one step that can spike, and the OOM killer
# shows up as a container dying with exit code 137 and no other explanation.
# 4 GB of insurance costs nothing against the 200 GB free block allowance.
if ! swapon --show | grep -q .; then
  log "adding 4 GB swap"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  log "swap already present — skipping"
fi

# ── 4. Bootstrap TLS ─────────────────────────────────────────
# nginx refuses to start without a certificate file, and certbot
# needs nginx running to answer the ACME challenge. Break the
# deadlock with a throwaway self-signed pair, then replace it.
CERT_DIR="/var/lib/docker/volumes/nodpeak_certbot_conf/_data/live/${DOMAIN}"
if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  log "creating temporary self-signed certificate for ${DOMAIN}"
  docker volume create nodpeak_certbot_conf >/dev/null
  docker volume create nodpeak_certbot_www  >/dev/null
  # The directory has to exist before openssl can write into it, so this runs
  # as one shell command rather than a bare `openssl` entrypoint.
  docker run --rm --entrypoint sh -v nodpeak_certbot_conf:/etc/letsencrypt certbot/certbot \
    -c "mkdir -p /etc/letsencrypt/live/${DOMAIN} && \
        openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
          -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
          -out    /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
          -subj '/CN=${DOMAIN}'"
  TEMP_CERT=1
fi

# ── 5. Build and start ───────────────────────────────────────
log "building images (this takes a few minutes on first run)"
docker compose build

log "starting stack"
docker compose up -d

log "waiting for nginx to answer on :80"
for i in $(seq 1 30); do
  curl -fsS -o /dev/null "http://localhost/.well-known/acme-challenge/ping" 2>/dev/null && break
  curl -fsS -o /dev/null "http://localhost/" 2>/dev/null && break
  sleep 2
done

# ── 6. Real certificate ──────────────────────────────────────
if [[ "${TEMP_CERT:-0}" == "1" ]]; then
  log "requesting Let's Encrypt certificate for ${DOMAIN}"
  docker run --rm \
    -v nodpeak_certbot_conf:/etc/letsencrypt \
    -v nodpeak_certbot_www:/var/www/certbot \
    certbot/certbot certonly --webroot -w /var/www/certbot \
      --email "${CERTBOT_EMAIL}" --agree-tos --no-eff-email \
      --force-renewal -d "${DOMAIN}" \
    || warn "certbot failed — the stack is up on HTTP. Check DNS points at this box, then rerun."

  log "reloading nginx with the real certificate"
  docker compose exec -T nginx nginx -s reload || docker compose restart nginx
fi

# ── 7. Done ──────────────────────────────────────────────────
log "waiting for app health"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 2
done

cat <<EOF

${GRN}────────────────────────────────────────────────────${NC}
 Nodpeak is live.

   Dashboard   https://${DOMAIN}
   Register    https://${DOMAIN}/register
   Widget      https://${DOMAIN}/widget.js
   Health      https://${DOMAIN}/api/health

 Logs      docker compose logs -f app
 Restart   docker compose restart
 Update    git pull && docker compose build && docker compose up -d
 Backup    docker run --rm -v nodpeak_data:/data -v \$PWD:/out \\
             alpine tar czf /out/nodpeak-backup.tar.gz -C /data .
${GRN}────────────────────────────────────────────────────${NC}

EOF
