# NIELIT AppSec + Cyber-Awareness Training Platform

A bilingual (Hindi/English) security-training platform built to run on a **single ~5 GB VM**.
Two modules share one content schema, one telemetry spine, and one AI-mentor pipeline:

- **AppSec module** — hands-on vulnerability labs (SQLi, XSS, IDOR, SSRF …), routed by a
  **tiered execution model** (a per-user container is the exception, not the default).
- **Cyber-Awareness module** — scenario-based fraud training (UPI scams, digital arrest,
  phishing …) as branching decision trees. All Tier 0, memory-free.

> This repo ships the **Phase 1 vertical slice**: one AppSec lab (**SQL Injection**, Tier 2)
> and one awareness lab (**Digital Arrest**, Tier 0), each working end-to-end —
> content → engine → telemetry → server-side scoring → HMAC certificate → RBAC → mentor →
> bilingual. Adding a lab = dropping a validated JSON file into `labs/manifests/`.

## Architecture at a glance

```
web/          React + Vite SPA — desktop shell, scenario engine, AppSec renderer, mentor widget
lab-manager/  Express + TypeScript — tiered routing, RBAC, telemetry, scoring, certs, mentor
labs/         Master content schema (§17) + validated manifests (adding a lab = a file)
db/           Postgres schema + seed (users, roles, cohorts, events, scores, certs, quiz_keys)
lab-images/   Minimal Tier-3 target images (~30-40 MB)
```

## The tiered execution model

| Tier | What runs | Memory |
|---|---|---|
| 0 – Static | client-side + content only | ~0 |
| 1 – Simulated | deterministic JSON engine, mocked responses | shared, tiny |
| 2 – Shared multi-tenant app | ONE hardened vulnerable app; per-user = a DB row + reset | ~150-300 MB total |
| 3 – Ephemeral per-user container | real isolated Linux, capped + reaped | ~80-200 MB per active user |

## Quick start

**In a VirtualBox VM, out of the box** → `vagrant up` (or `sudo bash scripts/provision-vm.sh`
on any fresh Ubuntu VM). It installs Docker, generates secrets, and brings the whole stack
up on host ports 8080/4000. Full guide incl. running the mentor on a **Jetson Nano**:
[`VM-SETUP.md`](VM-SETUP.md).

**With Docker directly:**

```bash
cp .env.example .env                 # pick Profile A (api) / B (off-VM ollama) / C (in-VM) / D (jetson)
# generate real secrets:
#   openssl rand -hex 32   → JWT_SECRET, CERT_SIGNING_SECRET
# build the Tier-3 target images the lab-manager spawns (id → nielit/<id>:latest).
# NOTE: brace ${tag} — bare $tag:latest triggers zsh's :l modifier and mis-tags.
# --network=host: the images are Debian-based and apt-install a couple of tools at
# BUILD time (the default build sandbox has no egress here).
for pair in cmdi-python:command-injection ssrf:ssrf xxe:xxe \
            deserialization:deserialization path-traversal:path-traversal; do
  docker build --network=host -t "nielit/${pair##*:}:latest" "lab-images/${pair%%:*}"
done
docker compose up --build            # add --profile local-llm ONLY for Profile C
# `docker compose up` also starts the apt-proxy (apt-cacher-ng) + the internal
# `nielit-labnet`, which give Tier-3 lab boxes `apt install` with NO direct internet.
# web:  http://localhost:8080
# api:  http://localhost:4000/health
```

> **Tier-3 note:** the browser terminal (xterm ↔ WebSocket ↔ `docker exec`) needs the
> Docker socket, mounted into `lab-manager` in `docker-compose.yml`. Containers run
> `--network none --read-only --cap-drop=ALL` (egress locked, verified). Set
> `CONTAINER_RUNTIME=runsc` in `.env` to sandbox with **gVisor** where it's installed.

Seed logins (dev only, see `db/seed.sql`): `student@nielit.test` / `instructor@nielit.test` /
`admin@nielit.test`, password `password123`.

## Local dev (no Docker)

```bash
# needs a local Postgres + Redis reachable via .env
cd lab-manager && npm install && npm run dev      # api on :4000
cd web         && npm install && npm run dev      # vite on :5173 (proxies /api → :4000)
```

## Why this design (interview framing)

- Teaches BOLA / broken-function-level-authz, so its **own** authz is deny-by-default,
  permission-checked (not role-checked), and **scope-resolved** (`:self`, cohort, container-owner).
- Built for a 5 GB VM: an atomic Redis counter caps Tier-3 concurrency and **queues** overflow;
  an idle reaper protects the budget; every container is 128 MB-capped, read-only, gVisor-sandboxed.
- Mentor provider is **one env var**; it's a shared queued instance, hardened against the exact
  prompt injection the platform teaches.
- Telemetry events are **server-emitted from verified actions**; certificates are **HMAC-signed** —
  completion cannot be forged.

See [`PROJECT_SPEC.md`](../Downloads/PROJECT_SPEC.md) for the full build brief.
