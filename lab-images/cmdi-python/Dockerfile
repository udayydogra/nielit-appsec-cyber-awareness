# Tier-3 command-injection target. Debian-based so students get `apt` in their box
# (packages come via the internal caching proxy — the lab network has no direct
# internet). Still a small single-process target; the writable layer + installs are
# wiped when the ephemeral container is reaped (on exit / 30-min max life).
FROM python:3.12-slim
WORKDIR /app
COPY app.py .

# Pre-bake ping (for the vulnerable helper) at BUILD time using direct internet.
RUN apt-get update \
 && apt-get install -y --no-install-recommends iputils-ping ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Then point apt at the internal caching proxy for RUNTIME. Anything students install
# (nmap, curl, git, vim…) is fetched+cached by the proxy; direct egress to the
# internet stays blocked by the `internal` lab network.
RUN printf 'Acquire::http::Proxy "http://nielit-apt-proxy:3142";\n' > /etc/apt/apt.conf.d/01proxy \
 && printf 'APT::Install-Recommends "false";\nAPT::Install-Suggests "false";\n' > /etc/apt/apt.conf.d/02lean

# A deliberately vulnerable "ping check" helper (builds a shell command by string
# interpolation) + the flag + a MOTD. The student reaches a shell via command
# injection and explores an isolated, capped, proxy-only, auto-reaped container.
RUN useradd -m -s /bin/bash labuser \
 && mkdir -p /challenge \
 && printf 'flag{cmdi_rce_in_ephemeral_container}\n' > /challenge/flag.txt \
 && printf '#!/bin/sh\n# VULNERABLE: interpolates $1 into a shell command\nsh -c "ping -c 1 $1"\n' > /usr/local/bin/vulnping \
 && chmod 0755 /usr/local/bin/vulnping /challenge/flag.txt \
 && printf 'NIELIT command-injection target (Kali-style box).\nYou landed a shell via command injection in the ping service.\n\nTry:\n  id\n  vulnping "127.0.0.1; whoami"      # see the injection mechanism\n  cat /challenge/flag.txt\n  apt install nmap                   # yes, you can install tools\n\nThis box is a Tier-3 sandbox: NO internet egress (only the apt proxy),\ncapabilities dropped, no host privilege escalation, and it is auto-reaped\nwhen you leave (or after 30 min). Installed tools vanish with it.\n' > /challenge/README

EXPOSE 8000
# The HTTP app runs as labuser; the lab drives the box via a ROOT docker-exec shell
# so students can apt-install on their own container.
USER labuser
CMD ["python", "app.py"]
