const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;

function getDateStr(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function today() { return getDateStr(new Date()); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return getDateStr(d); }

function runCcusage(args) {
  return new Promise((resolve) => {
    exec(`npx -y ccusage@latest ${args}`, { timeout: 90000 }, (_err, stdout) => {
      resolve((stdout || '').trim());
    });
  });
}

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try { return JSON.parse(raw) || fallback; } catch {
    const i = raw.indexOf('{');
    if (i !== -1) try { return JSON.parse(raw.slice(i)) || fallback; } catch {}
    return fallback;
  }
}

const ROUTES = {
  '/api/today': async () => {
    const t = today();
    return safeParse(await runCcusage(`daily --since ${t} --until ${t} --json`));
  },
  '/api/daily': async (p) => {
    const since = p.get('since') || daysAgo(29);
    const until = p.get('until') || today();
    return safeParse(await runCcusage(`daily --since ${since} --until ${until} --json`));
  },
  '/api/weekly': async () => safeParse(await runCcusage('weekly --json')),
  '/api/monthly': async () => safeParse(await runCcusage('monthly --json')),
};

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) { res.writeHead(500); res.end(e.message); }
    return;
  }

  const handler = ROUTES[pathname];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const result = await handler(searchParams);
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n✅  CCUsage Dashboard → http://localhost:${PORT}\n`);
  console.log('   按 Ctrl+C 停止服务\n');
});
