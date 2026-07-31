#!/usr/bin/env bash
# Record a walkthrough GIF of the running app → docs/screenshots/demo.gif
#
# Prereqs: the stack running on http://localhost:8080, plus `chromium` (or Chrome)
# and `ffmpeg` installed. Then just:  bash scripts/record-demo.sh
#
# It logs in with the dev student account, walks dashboard → AppSec → SQLi lab →
# awareness → the "digital arrest" scam scenario (answering the video call), captures
# frames, and assembles a small, palette-optimised GIF.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"
OUT="$REPO/docs/screenshots"; mkdir -p "$OUT"
URL="${URL:-http://localhost:8080}"
CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome || command -v google-chrome-stable)"
[ -n "$CHROME" ] || { echo "no chromium/chrome found"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not installed"; exit 1; }

# Work off a real disk (not a tiny /tmp tmpfs) to avoid ENOSPC while chromium runs.
WORK="$HOME/.nielit-rec"; rm -rf "$WORK"; mkdir -p "$WORK/frames"
export TMPDIR="$WORK/tmp"; mkdir -p "$TMPDIR"
cd "$WORK"
PUPPETEER_SKIP_DOWNLOAD=1 npm i puppeteer-core >/dev/null 2>&1

FRAMES="$WORK/frames" CHROME="$CHROME" URL="$URL" node --input-type=module <<'JS'
import puppeteer from 'puppeteer-core';
const {FRAMES, CHROME, URL} = process.env;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let n = 0;
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--force-color-profile=srgb'] });
const page = await b.newPage();
await page.setViewport({width:1280, height:820, deviceScaleFactor:1});
const grab = async (hold=2) => { for(let i=0;i<hold;i++){ await page.screenshot({path:`${FRAMES}/f${String(n++).padStart(3,'0')}.png`}); await sleep(120);} };
const click = async (t) => page.evaluate((x)=>{ const els=[...document.querySelectorAll('button,a,[role="button"]')];
  const el=els.find(e=>((e.textContent||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('title')||'')).toUpperCase().includes(x.toUpperCase()));
  if(el){el.scrollIntoView({block:'center'});el.click();return true;} return false; }, t);
const waitText = (t,ms=15000)=>page.waitForFunction((x)=>document.body.innerText.includes(x),{timeout:ms},t).catch(()=>{});

try{
  await page.goto(URL,{waitUntil:'networkidle2',timeout:30000});
  await page.evaluate(()=>{ const e=document.querySelector('input[type=email]'),p=document.querySelector('input[type=password]');
    if(e){e.value='student@nielit.test';e.dispatchEvent(new Event('input',{bubbles:true}));}
    if(p){p.value='password123';p.dispatchEvent(new Event('input',{bubbles:true}));} });
  await click('LOG IN'); await waitText('TOTAL LABS'); await click('EN'); await sleep(600);
  await grab(4);                                                    // dashboard
  if(await click('APPSEC LABS')){ await sleep(1200); await grab(3);} // catalogue
  if(await click('SQL INJECTION')){ await sleep(1500); await grab(2);
    await page.evaluate(()=>window.scrollBy(0,520)); await sleep(500); await grab(2);} // sqli lab + scroll
  await page.goto(URL,{waitUntil:'networkidle2'}); await sleep(600); await click('EN'); await sleep(300);
  if(await click('CYBER AWARENESS')){ await sleep(1000); await grab(3);}
  if(await click('DIGITAL ARREST')){ await sleep(1200); await grab(3);   // SMS scene
    if(await click('NEXT')){ await sleep(800); await grab(2);
      if(await click('PRESS 1')){ await sleep(1000); await grab(2);      // ring
        if(await click('PICK UP')||await click('ANSWER')){ await sleep(1500); await grab(6);} }}} // video call
  console.log('frames captured:', n);
}finally{ await b.close(); }
JS

# Assemble a small palette-optimised GIF (~2 fps slideshow).
ffmpeg -y -framerate 2 -i "$FRAMES/f%03d.png" \
  -vf "scale=820:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer" \
  "$OUT/demo.gif" >/dev/null 2>&1
SIZE=$(du -h "$OUT/demo.gif" | cut -f1)
rm -rf "$WORK"
echo "✅ saved $OUT/demo.gif ($SIZE)"
echo "   Add to README under '## See it running':  ![demo](docs/screenshots/demo.gif)"
