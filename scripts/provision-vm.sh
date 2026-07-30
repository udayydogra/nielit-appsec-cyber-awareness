#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Provision a fresh Ubuntu VM so the whole NIELIT platform comes up out-of-the-box.
# Idempotent: safe to re-run. Works two ways:
#   • Vagrant  — invoked automatically as root; repo is at /vagrant.
#   • Manual   — on any fresh Ubuntu 22.04+ VM:  sudo bash scripts/provision-vm.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

log() { printf '\n\033[1;36m[provision]\033[0m %s\n' "$*"; }

# ── 0. Where is the app? ──────────────────────────────────────────────────────
# Under Vagrant the synced repo is at /vagrant; copy it to a native dir so Docker
# builds don't run over the (slow, permission-quirky) VirtualBox shared folder.
if [ -d /vagrant ] && [ -f /vagrant/docker-compose.yml ]; then
  SRC=/vagrant
  APP=/opt/nielit
  log "Vagrant detected — syncing $SRC → $APP"
  mkdir -p "$APP"
  rsync -a --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
    --exclude '.env' "$SRC"/ "$APP"/
else
  # Manual run: use the repo this script lives in.
  APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  log "Manual run — using repo at $APP"
fi

# Who will own/run things (the login user, not root).
RUN_USER="${SUDO_USER:-${USER:-root}}"

# ── 1. Docker Engine + Compose plugin ─────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine + Compose plugin"
  export DEBIAN_FRONTEND=noninteractive
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO="${ID:-ubuntu}"          # debian | ubuntu — Docker publishes an apt repo for both
  case "$DISTRO" in debian|ubuntu) ;; *) DISTRO=ubuntu ;; esac
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git rsync openssl >/dev/null
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DISTRO}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${DISTRO} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  log "Docker installed on ${DISTRO}: $(docker --version)"
else
  log "Docker already present: $(docker --version)"
  command -v git   >/dev/null || apt-get install -y -qq git   >/dev/null || true
  command -v rsync >/dev/null || apt-get install -y -qq rsync >/dev/null || true
fi

# Let the login user run docker without sudo (takes effect on next login).
if [ "$RUN_USER" != "root" ]; then
  usermod -aG docker "$RUN_USER" 2>/dev/null || true
fi
systemctl enable --now docker >/dev/null 2>&1 || true

# ── 2. .env with real secrets (generated once, never overwritten) ─────────────
cd "$APP"
if [ ! -f .env ]; then
  log "Creating .env from .env.example + generating secrets"
  cp .env.example .env
  gen() { openssl rand -hex 32; }
  # Replace the dev-default secrets with real random ones.
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(gen)|"                     .env
  sed -i "s|^CERT_SIGNING_SECRET=.*|CERT_SIGNING_SECRET=$(gen)|"   .env
  chmod 600 .env
else
  log ".env already exists — leaving it untouched"
fi

# ── 2.5 Build the Tier-3 lab target images (id → nielit/<id>:latest) ───────────
# The lab-manager spawns these on demand for Tier-3 labs (command-injection, ssrf,
# xxe, deserialization, path-traversal). They're Debian-based and apt-install a few
# tools at BUILD time, so --network=host gives the build egress.
log "Building Tier-3 lab target images"
for pair in cmdi-python:command-injection ssrf:ssrf xxe:xxe \
            deserialization:deserialization path-traversal:path-traversal; do
  dir="lab-images/${pair%%:*}"; img="nielit/${pair##*:}:latest"
  if [ -f "$dir/Dockerfile" ]; then
    log "  → $img (from $dir)"
    docker build --network=host -t "$img" "$dir" || log "  ! $img build failed (Tier-3 lab '${pair##*:}' will be unavailable)"
  fi
done

# ── 3. Bring the stack up ─────────────────────────────────────────────────────
# --profile local-llm is added only if the .env selects the in-VM Ollama (C).
COMPOSE_PROFILES=""
if grep -qE '^MENTOR_PROVIDER=ollama' .env && grep -qE '^MENTOR_OLLAMA_BASE=http://ollama:11434' .env; then
  COMPOSE_PROFILES="--profile local-llm"
  log "Profile C (in-VM Ollama) selected — enabling the local-llm compose profile"
fi

log "Building and starting containers (first run pulls images + compiles node-pty; be patient)"
docker compose $COMPOSE_PROFILES up -d --build

# ── 4. Report ─────────────────────────────────────────────────────────────────
log "Done. Services:"
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}' || docker compose ps
cat <<EOF

──────────────────────────────────────────────────────────────────────────────
  ✅ NIELIT platform is up.

  From the HOST machine (Vagrant forwards these ports):
     Web  →  http://localhost:8080
     API  →  http://localhost:4000/health

  AI Mentor: edit $APP/.env → MENTOR_PROVIDER, then:  docker compose up -d
     A) api     — set MENTOR_API_KEY
     C) in-VM   — MENTOR_PROVIDER=ollama + start with --profile local-llm,
                  then:  docker compose exec ollama ollama pull qwen2.5:3b
     D) Jetson  — MENTOR_PROVIDER=jetson + MENTOR_JETSON_BASE=http://<nano-ip>:11434
──────────────────────────────────────────────────────────────────────────────
EOF
