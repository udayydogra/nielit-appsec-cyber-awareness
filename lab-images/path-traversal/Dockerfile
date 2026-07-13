# Tier-3 Path-Traversal target (~8 MB). `getfile` serves from /srv/public but
# never sanitizes the path, so ../ escapes the intended directory. Reading
# /etc/passwd is safely contained to this ephemeral container.
FROM alpine:3.20
RUN adduser -D -H labuser \
 && mkdir -p /srv/public /challenge \
 && printf '<html>public homepage</html>\n' > /srv/public/index.html \
 && printf 'welcome to the public site\n' > /srv/public/readme.txt \
 && printf 'flag{path_traversal_arbitrary_file_read}\n' > /challenge/flag.txt \
 && printf '#!/bin/sh\n# VULNERABLE: no sanitization of $1 -> ../ escapes /srv/public\ncat "/srv/public/$1"\n' > /usr/local/bin/getfile \
 && chmod 0755 /usr/local/bin/getfile /challenge/flag.txt \
 && printf 'NIELIT path-traversal target.\ngetfile serves from /srv/public but does not sanitize the path.\n\nTry:\n  getfile index.html\n  getfile ../../challenge/flag.txt\n  getfile ../../etc/passwd\n' > /challenge/README
USER labuser
CMD ["sleep", "infinity"]
