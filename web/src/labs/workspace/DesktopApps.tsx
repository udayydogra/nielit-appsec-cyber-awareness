import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Search, Star, Lock,
  Folder, FileText, FileCode, FileArchive, HardDrive, Download, Monitor, Wrench,
} from 'lucide-react';

// The extra "apps" that make the lab desktop feel like a real OS: a Browser, a File
// Manager, a Notepad and a Text viewer. Everything renders offline (no external
// network — CSP-safe on the air-gapped VM); the browser's pages are sandboxed HTML.

// ─────────────────────────────── Browser ────────────────────────────────────
type Page = { url: string; title: string; html: string };

function makePages(labTitle: string): Record<string, Page> {
  const shell = (body: string, bg = '#0b1220') =>
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;font-family:system-ui,Arial,sans-serif;background:${bg};color:#e2e8f0}
      a{color:#60a5fa} .wrap{max-width:760px;margin:0 auto;padding:36px 22px}
      .card{background:#111a2e;border:1px solid #1e293b;border-radius:14px;padding:22px;margin:14px 0}
      input,button{font:inherit} h1{margin:.2em 0} code{background:#0b1220;padding:2px 6px;border-radius:6px}
      .tile{display:inline-block;width:120px;padding:16px;margin:8px;text-align:center;background:#111a2e;border:1px solid #1e293b;border-radius:12px;color:#cbd5e1;text-decoration:none}
      .field{display:block;width:100%;padding:11px 13px;margin:6px 0;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#e2e8f0}
      .btn{background:#2563eb;border:none;color:#fff;padding:11px 18px;border-radius:9px;cursor:pointer;font-weight:700}
    </style></head><body><div class="wrap">${body}</div></body></html>`;

  return {
    start: {
      url: 'about:home', title: 'New Tab',
      html: shell(`
        <div style="text-align:center;padding-top:20px">
          <div style="font-size:34px;font-weight:800;letter-spacing:-.02em">NIELIT<span style="color:#60a5fa">Search</span></div>
          <div style="margin:18px auto;max-width:520px"><input class="field" placeholder="Search or type a URL" style="text-align:center"></div>
          <div>
            <a class="tile" href="#">🎯<br>Target App</a>
            <a class="tile" href="#">📚<br>OWASP Docs</a>
            <a class="tile" href="#">🧰<br>Cheat Sheet</a>
            <a class="tile" href="#">🏛️<br>cybercrime.gov.in</a>
          </div>
        </div>`),
    },
    target: {
      url: 'http://target.lab.local/', title: 'Target — Login',
      html: shell(`
        <div class="card">
          <h1>🎯 Vulnerable Target</h1>
          <p style="color:#94a3b8">This is the deliberately-vulnerable application for <b>${labTitle}</b>.
          Run your exploit from the <b>Exploit Console</b> or <b>Terminal</b> — this page shows what a victim would see.</p>
        </div>
        <div class="card">
          <h2 style="margin-top:0">Admin Portal — Sign in</h2>
          <input class="field" placeholder="username"><input class="field" type="password" placeholder="password">
          <button class="btn">Log in</button>
          <p style="color:#64748b;font-size:13px;margin-bottom:0">Forgot password? · Powered by <code>vuln-webapp/1.0</code></p>
        </div>`, '#0e1626'),
    },
    docs: {
      url: 'https://owasp.org/', title: 'OWASP — Reference',
      html: shell(`
        <div class="card">
          <h1>OWASP Reference</h1>
          <p style="color:#94a3b8">Offline reference bundled with the lab.</p>
        </div>
        <div class="card"><h3 style="margin-top:0">Root cause</h3>
          <p>Untrusted input is used where the system expects trusted data — a query, a command, a path, or markup — so the attacker changes the <i>meaning</i> of the operation.</p></div>
        <div class="card"><h3 style="margin-top:0">The fix, in one line</h3>
          <p>Keep <b>data</b> and <b>code</b> separate: parameterise queries, pass argument vectors (never a shell string), canonicalise and allow-list paths, and escape output for its context.</p></div>
        <div class="card"><h3 style="margin-top:0">Defence in depth</h3>
          <p>Least privilege, deny-by-default authorization, input validation as a second layer, and monitoring for anomalies.</p></div>`),
    },
    cheats: {
      url: 'https://cheatsheet.lab.local/', title: 'Cheat Sheet',
      html: shell(`
        <div class="card"><h1>🧰 Quick cheat sheet</h1></div>
        <div class="card"><h3 style="margin-top:0">Recon</h3><p><code>id</code> · <code>whoami</code> · <code>uname -a</code> · <code>cat /etc/passwd</code> · <code>ls -la</code></p></div>
        <div class="card"><h3 style="margin-top:0">SQL injection</h3><p><code>' OR '1'='1</code> · <code>' UNION SELECT ... --</code></p></div>
        <div class="card"><h3 style="margin-top:0">Command injection</h3><p><code>127.0.0.1; id</code> · <code>$(cat flag.txt)</code> · <code>| whoami</code></p></div>
        <div class="card"><h3 style="margin-top:0">Report fraud</h3><p>Cyber-crime helpline <b>1930</b> · <b>cybercrime.gov.in</b></p></div>`),
    },
  };
}

export function Browser({ labTitle }: { labTitle: string }) {
  const pages = useMemo(() => makePages(labTitle), [labTitle]);
  const keys = Object.keys(pages);
  const [hist, setHist] = useState<string[]>(['start']);
  const [i, setI] = useState(0);
  const cur = pages[hist[i]];
  const [addr, setAddr] = useState(cur.url);

  function go(key: string) {
    const h = hist.slice(0, i + 1).concat(key);
    setHist(h); setI(h.length - 1); setAddr(pages[key].url);
  }
  function back() { if (i > 0) { setI(i - 1); setAddr(pages[hist[i - 1]].url); } }
  function fwd() { if (i < hist.length - 1) { setI(i + 1); setAddr(pages[hist[i + 1]].url); } }
  function submitAddr(e: React.FormEvent) {
    e.preventDefault();
    const hit = keys.find((k) => pages[k].url === addr.trim() || pages[k].url.includes(addr.trim()));
    go(hit ?? 'start');
  }

  const bookmarks: [string, string][] = [['target', '🎯 Target'], ['docs', '📚 OWASP'], ['cheats', '🧰 Cheats'], ['start', '🏠 Home']];

  return (
    <div className="ws-browser">
      <div className="ws-br-tabs">
        <div className="ws-br-tab active"><Lock size={11} /> {cur.title}</div>
      </div>
      <div className="ws-br-bar">
        <button onClick={back} disabled={i === 0} title="Back"><ArrowLeft size={15} /></button>
        <button onClick={fwd} disabled={i === hist.length - 1} title="Forward"><ArrowRight size={15} /></button>
        <button onClick={() => go(hist[i])} title="Reload"><RotateCw size={14} /></button>
        <button onClick={() => go('start')} title="Home"><Home size={14} /></button>
        <form className="ws-br-addr" onSubmit={submitAddr}>
          <Lock size={12} />
          <input value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} />
          <Search size={13} />
        </form>
      </div>
      <div className="ws-br-marks">
        {bookmarks.map(([k, label]) => (
          <button key={k} onClick={() => go(k)}><Star size={11} /> {label}</button>
        ))}
      </div>
      <iframe className="ws-br-view" title="browser" sandbox="" srcDoc={cur.html} />
    </div>
  );
}

// ───────────────────────────── File Manager ─────────────────────────────────
type FsNode = { type: 'dir'; children: Record<string, FsNode> } | { type: 'file'; content: string; kind?: 'code' | 'zip' };
const dir = (children: Record<string, FsNode>): FsNode => ({ type: 'dir', children });
const file = (content: string, kind?: 'code' | 'zip'): FsNode => ({ type: 'file', content, kind });

const FS: FsNode = dir({
  root: dir({
    Desktop: dir({
      'target-notes.txt': file('Target: http://target.lab.local/\nStart with recon, then find the injectable input.\nFlag format: flag{...}\n'),
    }),
    Documents: dir({
      'methodology.txt': file('1. Recon (id, ls, cat README)\n2. Map the attack surface\n3. Exploit the vulnerable input\n4. Read the flag\n5. Write the fix\n'),
      'report-template.md': file('# Findings\n\n## Summary\n\n## Steps to reproduce\n\n## Impact\n\n## Remediation\n', 'code'),
    }),
    Downloads: dir({
      'rockyou-mini.txt': file('123456\npassword\nadmin\nletmein\nqwerty\nS3cr3t_Adm1n_pw\n'),
      'payloads.txt': file("' OR '1'='1\n' UNION SELECT username, role, secret_note FROM accounts -- \n127.0.0.1; cat /challenge/flag.txt\n../../../../etc/passwd\n"),
    }),
    Tools: dir({
      'sqlmap': dir({ 'README': file('sqlmap — automatic SQL injection tool (simulated placeholder).\n') }),
      'nmap': dir({ 'README': file('nmap — network mapper (simulated placeholder).\n') }),
      'wordlists.zip': file('', 'zip'),
    }),
    '.bashrc': file('export PS1="\\u@lab:\\w$ "\nalias ll="ls -la"\n', 'code'),
    'README.txt': file('Welcome to the NIELIT lab box.\nYour home is /root. Useful files live in Documents, Downloads and Tools.\n'),
  }),
});

function nodeAt(path: string[]): FsNode | null {
  let n: FsNode = FS;
  for (const seg of path) {
    if (n.type !== 'dir' || !n.children[seg]) return null;
    n = n.children[seg];
  }
  return n;
}

export function FileManager({ onOpenFile }: { onOpenFile: (title: string, content: string) => void }) {
  const [path, setPath] = useState<string[]>(['root']);
  const node = nodeAt(path);
  const entries = node && node.type === 'dir' ? Object.entries(node.children) : [];

  const places: { label: string; icon: typeof Home; path: string[] }[] = [
    { label: 'Home', icon: Home, path: ['root'] },
    { label: 'Desktop', icon: Monitor, path: ['root', 'Desktop'] },
    { label: 'Documents', icon: FileText, path: ['root', 'Documents'] },
    { label: 'Downloads', icon: Download, path: ['root', 'Downloads'] },
    { label: 'Tools', icon: Wrench, path: ['root', 'Tools'] },
    { label: 'Filesystem', icon: HardDrive, path: [] },
  ];

  function open(name: string, n: FsNode) {
    if (n.type === 'dir') setPath([...path, name]);
    else if (n.kind === 'zip') { /* archives just sit there */ }
    else onOpenFile(name, n.content);
  }

  const iconFor = (n: FsNode) =>
    n.type === 'dir' ? <Folder size={30} className="fi-dir" />
      : n.kind === 'code' ? <FileCode size={30} className="fi-code" />
      : n.kind === 'zip' ? <FileArchive size={30} className="fi-zip" />
      : <FileText size={30} className="fi-txt" />;

  return (
    <div className="ws-files">
      <div className="ws-files-side">
        <div className="ws-files-side-h">Places</div>
        {places.map((p) => (
          <button key={p.label} className={path.join('/') === p.path.join('/') ? 'active' : ''} onClick={() => setPath(p.path)}>
            <p.icon size={15} /> {p.label}
          </button>
        ))}
      </div>
      <div className="ws-files-main">
        <div className="ws-files-crumb">
          <button onClick={() => setPath(path.slice(0, -1))} disabled={path.length === 0} title="Up"><ArrowLeft size={14} /></button>
          <span className="crumb"><HardDrive size={12} /> /{path.join('/')}</span>
        </div>
        <div className="ws-files-grid">
          {entries.length === 0 && <div className="ws-files-empty">Empty folder</div>}
          {entries.map(([name, n]) => (
            <button key={name} className="ws-file" onDoubleClick={() => open(name, n)} onClick={(e) => { if (e.detail === 0) open(name, n); }}>
              {iconFor(n)}<span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Notepad & Text viewer ──────────────────────────
export function Notepad() {
  const [txt, setTxt] = useState('# Scratchpad\n\nType your notes, payloads and findings here…\n');
  return <textarea className="ws-notepad" value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} />;
}

export function TextViewer({ data }: { data: { title: string; content: string } | null }) {
  if (!data) return <div className="ws-textview ws-textview-empty">Open a file from the File Manager.</div>;
  return <pre className="ws-textview">{data.content}</pre>;
}
