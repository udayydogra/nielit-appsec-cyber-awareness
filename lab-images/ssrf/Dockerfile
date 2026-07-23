# Tier-3 SSRF target. Debian-based so students get `apt` (via the internal proxy).
# A "link preview" fetcher with no allow-list + a loopback metadata service.
FROM python:3.12-slim
WORKDIR /app
COPY metadata.py .
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN printf 'Acquire::http::Proxy "http://nielit-apt-proxy:3142";\n' > /etc/apt/apt.conf.d/01proxy \
 && printf 'APT::Install-Recommends "false";\nAPT::Install-Suggests "false";\n' > /etc/apt/apt.conf.d/02lean
RUN useradd -m -s /bin/bash labuser \
 && mkdir -p /challenge \
 && printf '#!/bin/sh\n# VULNERABLE: fetches ANY user-supplied URL, no allow-list\nwget -q -O- -T 3 "$1"\n' > /usr/local/bin/ssrf-fetch \
 && chmod 0755 /usr/local/bin/ssrf-fetch \
 && printf 'NIELIT SSRF target (Kali-style box).\nThe "link preview" service fetches any URL you give it (no allow-list).\n\nTry:\n  ssrf-fetch http://127.0.0.1:8080/latest/meta-data/iam/security-credentials/labrole\n  ssrf-fetch http://8.8.8.8            # external egress is blocked\n  apt install curl                    # you can install tools\n\n(127.0.0.1:8080 simulates the metadata service at 169.254.169.254.)\n' > /challenge/README
USER labuser
CMD ["python", "metadata.py"]
