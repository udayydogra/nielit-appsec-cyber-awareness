# Purpose-built minimal single-process target (~30-40 MB), NOT a DVWA-style LAMP.
# Keeps Tier-3 per-user cost low so ~12-15 users fit the budget instead of ~6.
FROM python:3.12-alpine
WORKDIR /app
COPY app.py .

# A deliberately vulnerable "ping check" helper (builds a shell command by string
# interpolation) + a flag + a MOTD. The student reaches a shell here via command
# injection and explores an isolated, capped, egress-locked, auto-reaped container.
RUN adduser -D -H labuser \
 && mkdir -p /challenge \
 && printf 'flag{cmdi_rce_in_ephemeral_container}\n' > /challenge/flag.txt \
 && printf '#!/bin/sh\n# VULNERABLE: interpolates $1 into a shell command\nsh -c "ping -c 1 $1"\n' > /usr/local/bin/vulnping \
 && chmod 0755 /usr/local/bin/vulnping /challenge/flag.txt \
 && printf 'NIELIT command-injection target.\nYou landed a shell via command injection in the ping service.\n\nTry:\n  id\n  vulnping "127.0.0.1; whoami"      # see the injection mechanism\n  cat /challenge/flag.txt\n  cat /etc/passwd\n\nThis box is a Tier-3 sandbox: no network egress, read-only FS,\nALL capabilities dropped, and it is auto-reaped when you leave.\nTry to reach the internet or escape — and watch it fail.\n' > /challenge/README

USER labuser
EXPOSE 8000
# The HTTP app keeps the container alive; the lab drives it via a docker-exec shell.
CMD ["python", "app.py"]
