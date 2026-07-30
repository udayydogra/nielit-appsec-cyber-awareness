# Running the platform (out of the box)

The whole stack — frontend, backend, Postgres, Redis, the apt-proxy, and (optionally) the
local LLM — runs via Docker Compose. Pick the option that matches your machine.

---

## Option 0 — Already on Linux? You probably DON'T need a VM

The VM exists so Windows/Mac users can get a Linux + Docker environment. **If your machine
is already Linux (Debian, Ubuntu, …), skip Vagrant/VirtualBox/libvirt entirely** and run the
stack directly:

```bash
git clone https://github.com/udayydogra/nielit-appsec-cyber-awareness.git
cd nielit-appsec-cyber-awareness
sudo bash scripts/provision-vm.sh        # installs Docker (Debian- & Ubuntu-aware), builds, runs
```

Then browse <http://localhost:8080>. No VM, no nested virtualization, no libvirt — this is the
simplest path and avoids the whole provider question below. The script detects Debian vs Ubuntu
and installs the right Docker repo automatically.

---

## Option 1 — Vagrant (auto-creates the VM; VirtualBox **or** libvirt/KVM)

**On your host you need** [Vagrant](https://www.vagrantup.com/) plus **one** provider —
[VirtualBox](https://www.virtualbox.org/) *or* libvirt/KVM. The Vagrantfile uses a
`generic/debian12` box that supports both; tell Vagrant which one to use:

```bash
vagrant up --provider=libvirt        # Linux/KVM host  (Debian default — see setup below)
# or
vagrant up --provider=virtualbox     # VirtualBox host
```

```bash
git clone https://github.com/udayydogra/nielit-appsec-cyber-awareness.git
cd nielit-appsec-cyber-awareness
vagrant up            # boots Ubuntu 22.04, installs Docker, builds + starts everything
```

`vagrant up` runs [`scripts/provision-vm.sh`](scripts/provision-vm.sh), which installs
Docker + the Compose plugin, generates real secrets into `.env`, builds the Tier-3 lab
images, and does `docker compose up -d --build`. First run takes a while (it pulls images
and compiles the `node-pty` native addon).

### libvirt/KVM one-time host setup (Debian/Fedora/…)

If `vagrant up` errors with **"error while connecting to libvirt"**, the libvirt provider
isn't ready yet. On Debian:

```bash
# 1. Install KVM + libvirt + the Vagrant plugin
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system libvirt-clients \
                    ebtables dnsmasq-base rsync build-essential libvirt-dev
vagrant plugin install vagrant-libvirt

# 2. Start the daemon and add yourself to the groups (then LOG OUT and back in)
sudo systemctl enable --now libvirtd
sudo usermod -aG libvirt,kvm "$USER"

# 3. Verify the socket is reachable (should list, not error)
virsh -c qemu:///system list --all

# 4. Now:
vagrant up --provider=libvirt
```

Common causes of that exact error: (a) `libvirtd` not running → step 2; (b) you're not in the
`libvirt` group / didn't re-login → step 2 + logout; (c) the `vagrant-libvirt` plugin isn't
installed → step 1; (d) KVM isn't available because you're **inside** a VM without nested
virtualization enabled → use Option 0 (run Docker directly) or `--provider=virtualbox`.

> Prefer not to deal with any of this? **Option 0** (run Docker directly on your Linux host)
> skips Vagrant and every provider entirely.

When it finishes, from **your host machine**:

- Web  → <http://localhost:8080>
- API  → <http://localhost:4000/health>

(The Vagrantfile forwards guest ports 8080/4000 to the same host ports.)

Everyday commands:

```bash
vagrant ssh                       # shell into the VM
vagrant halt                      # stop the VM
vagrant up                        # start it again (provision is idempotent)
vagrant destroy                   # remove it entirely

# inside the VM, the app lives at /opt/nielit:
cd /opt/nielit && docker compose ps
cd /opt/nielit && docker compose logs -f lab-manager
```

**Sizing.** The VM is set to **6 GB RAM / 2 CPU** (the stack targets ~5 GB; the extra is
headroom for Tier-3 lab containers). Docker images need disk — if your Vagrant box is
small, grow it:

```bash
vagrant plugin install vagrant-disksize   # then the Vagrantfile requests 30 GB
```

---

## Option 2 — Manual (any fresh Ubuntu 22.04+ VM)

If you built the VM yourself (VirtualBox → Ubuntu Server/Desktop), just clone and run the
same provisioning script:

```bash
git clone https://github.com/udayydogra/nielit-appsec-cyber-awareness.git
cd nielit-appsec-cyber-awareness
sudo bash scripts/provision-vm.sh
```

It installs Docker, generates `.env`, and brings the stack up in place. Then browse to the
VM's IP on ports **8080** (web) and **4000** (api) — or set up VirtualBox port-forwarding
(VM → Settings → Network → Advanced → Port Forwarding: host 8080 → guest 8080, host 4000 →
guest 4000) to reach it as `localhost`.

To run it by hand instead of the script:

```bash
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^CERT_SIGNING_SECRET=.*|CERT_SIGNING_SECRET=$(openssl rand -hex 32)|" .env
docker compose up -d --build
```

---

## The AI Mentor — four profiles, one env var

The Ollama-based mentor is provider-abstracted. Pick a profile in `.env`
(`MENTOR_PROVIDER=`), then `docker compose up -d`:

| Profile | `MENTOR_PROVIDER` | Where the model runs | Notes |
|--------|-------------------|----------------------|-------|
| **A** | `api` | Hosted API (Anthropic) | Lightest on the VM; set `MENTOR_API_KEY`. |
| **B** | `ollama` | Another box on your LAN | Point `MENTOR_OLLAMA_BASE` at it. |
| **C** | `ollama` | Inside the VM | `docker compose --profile local-llm up -d`, then pull a model. |
| **D** | `jetson` | A **Jetson Nano** on the LAN | Offloads the LLM onto edge hardware — details below. |

With `MENTOR_PROVIDER=api` and **no** API key, the mentor auto-falls back to Ollama, so it
never hard-fails out of the box.

---

## Profile D — running the mentor on a Jetson Nano

The Jetson Nano runs **Ollama** (same wire protocol as the in-VM one), so the VM just points
at it over the network. Nothing on the VM changes except two env vars.

### 1. On the Jetson Nano

```bash
# Install Ollama (arm64 build):
curl -fsSL https://ollama.com/install.sh | sh

# Serve on all interfaces so the VM can reach it (not just localhost):
sudo systemctl edit ollama       # add:  [Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama
# (or ad-hoc:  OLLAMA_HOST=0.0.0.0 ollama serve  )

# Pull a small model that fits the Nano's memory:
ollama pull qwen2.5:3b           # or a smaller tag like qwen2.5:1.5b / llama3.2:1b
```

Find the Nano's IP (`hostname -I`) and confirm it answers from the VM:

```bash
curl http://<nano-ip>:11434/api/tags
```

### 2. On the VM (`.env`)

```ini
MENTOR_PROVIDER=jetson
MENTOR_JETSON_BASE=http://<nano-ip>:11434     # static IP is more reliable than .local
MENTOR_JETSON_MODEL=qwen2.5:3b                # must match a model you pulled on the Nano
```

Then:

```bash
cd /opt/nielit && docker compose up -d lab-manager
docker compose logs lab-manager | grep mentor      # → [mentor] provider = jetson
```

### Networking notes

- The VM must be able to reach the Nano. In VirtualBox this usually means a **Bridged
  Adapter** (VM and Nano on the same LAN), not pure NAT. Alternatively add a Host-Only
  network the Nano can also reach.
- `*.local` (mDNS) works only if avahi is running on both ends; a **static IP** is the
  dependable choice for a deployed setup.
- The widget always talks to *your backend*, never the Nano directly — so the Nano never
  needs to be exposed to browsers, only to the VM.

### Why offload to a Jetson?

It keeps the LLM's RAM/compute **off** the 5 GB app VM (freeing that budget for lab
containers), keeps inference **on-premises** (no learner data leaves the local network —
the same privacy stance as Profile C), and turns the mentor into a cheap, always-on edge
appliance. If the Nano is unreachable the mentor degrades to a clear
`[mentor] cannot reach jetson — check MENTOR_JETSON_BASE` message rather than crashing.
