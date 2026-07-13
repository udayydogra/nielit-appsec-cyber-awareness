# Tier-3 SSRF target (~50 MB). A "link preview" fetcher with no destination
# allow-list, plus a loopback metadata service that stands in for the cloud
# metadata endpoint an SSRF reaches. External egress is blocked by --network none.
FROM python:3.12-alpine
WORKDIR /app
COPY metadata.py .
RUN adduser -D -H labuser \
 && mkdir -p /challenge \
 && printf '#!/bin/sh\n# VULNERABLE: fetches ANY user-supplied URL, no allow-list\nwget -q -O- -T 3 "$1"\n' > /usr/local/bin/ssrf-fetch \
 && chmod 0755 /usr/local/bin/ssrf-fetch \
 && printf 'NIELIT SSRF target.\nThe "link preview" service fetches any URL you give it (no allow-list).\nIt should only fetch public images.\n\nTry:\n  ssrf-fetch http://127.0.0.1:8080/latest/meta-data/iam/security-credentials/labrole\n  ssrf-fetch http://8.8.8.8            # external egress is blocked\n\n(127.0.0.1:8080 simulates the metadata service normally at 169.254.169.254.)\n' > /challenge/README
USER labuser
CMD ["python", "metadata.py"]
