// Headless Chrome screenshotter for the 6 prototype screens
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIR = 'D:\\AI WORKSPACE\\XiangQi\\prototype';
const OUT = 'D:\\AI WORKSPACE\\XiangQi\\prototype\\screenshots';

const screens = [
  { id: '01-loading',   file: 'screen-01-loading.html',   w: 1440, h: 900,  vp: '1440x900'  },
  { id: '02-main-board',file: 'screen-02-main-board.html',w: 1440, h: 900,  vp: '1440x900'  },
  { id: '03-history',   file: 'screen-03-history.html',   w: 1440, h: 900,  vp: '1440x900'  },
  { id: '04-victory',   file: 'screen-04-victory.html',   w: 1440, h: 900,  vp: '1440x900'  },
  { id: '05-mobile',    file: 'screen-05-mobile.html',    w: 390,  h: 844,  vp: '390x844'   },
  { id: '06-about',     file: 'screen-06-about.html',     w: 1440, h: 1800, vp: '1440x1800' },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

for (const s of screens) {
  const url = `file:///${path.join(DIR, s.file).replace(/\\/g, '/')}`;
  const out = path.join(OUT, `screen-${s.id}.png`);
  const cmd = [
    `"${CHROME}"`,
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--window-size=${s.vp}`,
    `--screenshot="${out}"`,
    `"${url}"`,
  ].join(' ');
  console.log(`[shot] ${s.id} -> ${out}`);
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
  } catch (e) {
    console.error(`[FAIL] ${s.id}: ${e.message}`);
  }
}

// list results
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png'));
for (const f of files) {
  const stat = fs.statSync(path.join(OUT, f));
  console.log(`  ${f}  ${(stat.size/1024).toFixed(1)} KB`);
}
console.log(`DONE: ${files.length} screenshots`);
