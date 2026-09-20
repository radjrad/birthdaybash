// Birthday Bash local server:  node tools/serve.mjs [port]
//
// 1. Serves the site (the builder fetches the engine files to make an export, so it needs http://, not file://).
// 2. Bridges the builder to the Claude Code CLI on this Mac, so generation runs on your Claude
//    subscription instead of an API key:  POST /api/claude  ->  `claude -p`  ->  text back.
//    Log in once with `claude` then `/login` (or `claude setup-token` and export CLAUDE_CODE_OAUTH_TOKEN).
//
// The bridge only listens on 127.0.0.1 and only answers pages served by this server, so no other
// website open in your browser can spend your subscription.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.ico':'image/x-icon' };

/* ---------- finding and running the CLI ---------- */
const CLI = process.env.BB_CLAUDE_BIN || [join(homedir(), '.local/bin/claude'), join(homedir(), '.claude/local/claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'].find(existsSync) || 'claude';
const MODELS = new Set(['claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5', 'claude-haiku-4-5']);

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;                      /* the whole point is to bill the subscription, not a key */
  if (env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDECODE) {   /* started from inside a Claude session: do not inherit that session's wiring */
    for (const k of Object.keys(env)) if ((/^CLAUDE_CODE_|^CLAUDECODE$|^CLAUDE_(PID|EFFORT|AGENT_SDK)/.test(k) && k !== 'CLAUDE_CODE_OAUTH_TOKEN') || k === 'ANTHROPIC_BASE_URL') delete env[k];
  }
  return env;
}
function run(args, input, cwd, ms) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    let child;
    try { child = spawn(CLI, args, { cwd, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return finish({ code: -1, out, err: String(e.message || e) }); }
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ code: -2, out, err: 'timed out' }); }, ms);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('error', e => finish({ code: -1, out, err: e.code === 'ENOENT' ? 'ENOENT' : String(e.message || e) }));
    child.on('close', code => finish({ code, out, err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}
function friendly(msg) {
  if (/ENOENT/.test(msg)) return 'The claude command was not found on this Mac. Install Claude Code, or set BB_CLAUDE_BIN to its path.';
  if (/authenticat|OAuth|log ?in|credential|401/i.test(msg)) return 'Claude Code on this Mac is not logged in (or the login expired). Open Terminal, run "claude", type /login, sign in with your Claude subscription, then try again.';
  if (/usage limit|rate limit|429|quota/i.test(msg)) return 'Your Claude subscription hit its usage limit for now. Try again after it resets, or switch to a smaller model.';
  if (/timed out/.test(msg)) return 'Claude took more than ten minutes and was stopped. Try again, or use fewer photos.';
  return 'Claude Code reported: ' + String(msg).slice(0, 400);
}

async function callClaude({ system, prompt, model, images, schema }) {
  const dir = await mkdtemp(join(tmpdir(), 'birthdaybash-'));
  try {
    await writeFile(join(dir, 'system.txt'), String(system || ''));
    const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--system-prompt-file', join(dir, 'system.txt')];
    if (MODELS.has(model)) args.push('--model', model);
    if (schema && typeof schema === 'object') args.push('--json-schema', JSON.stringify(schema));   /* the CLI then guarantees parseable, schema-valid JSON */
    let text = String(prompt || '');
    const pics = (Array.isArray(images) ? images : []).filter(im => im && /^[\w-]{1,20}$/.test(im.id) && typeof im.data === 'string').slice(0, 16);
    if (pics.length) {                               /* photos go in as files the CLI may Read, and nothing else */
      for (const im of pics) await writeFile(join(dir, im.id + '.jpg'), Buffer.from(im.data, 'base64'));
      args.push('--tools', 'Read', '--allowedTools', 'Read', '--add-dir', dir);
      text = `The host's photos are saved as JPEG files. Look at every one of them with the Read tool before you write anything:\n${pics.map(im => `- photo id "${im.id}": ${join(dir, im.id + '.jpg')}`).join('\n')}\nRefer to photos only by their id, never by path.\n\n${text}`;
    } else args.push('--tools', '');
    const r = await run(args, text, dir, 10 * 60 * 1000);
    let data = null; try { data = JSON.parse(r.out); } catch (e) {}
    if (Array.isArray(data)) data = data.find(x => x && x.type === 'result') || null;
    if (!data) return { error: friendly(r.err || r.out || `exit code ${r.code}`) };
    if (data.is_error) return { error: friendly(data.result || r.err || 'unknown error') };
    const answer = data.structured_output && typeof data.structured_output === 'object' ? JSON.stringify(data.structured_output) : data.result;
    if (typeof answer !== 'string') return { error: friendly(r.err || 'no result') };
    return { text: answer, usage: data.usage || null, cost: data.total_cost_usd };
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

/* ---------- http ---------- */
const sameOrigin = (req) => { const o = req.headers.origin; return !o || o === `http://localhost:${port}` || o === `http://127.0.0.1:${port}`; };
const json = (res, code, body) => res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
function readBody(req, limit) {
  return new Promise((resolve, reject) => { const chunks = []; let n = 0; req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); }); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); });
}

const handler = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const host = String(req.headers.host || '');
    if (!sameOrigin(req) || !/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return json(res, 403, { error: 'This bridge only answers the Birthday Bash page it serves.' });
    if (url.pathname === '/api/status' && req.method === 'GET') { const v = await run(['--version'], '', tmpdir(), 15000); return json(res, 200, { bridge: true, cli: v.code === 0, version: v.out.trim() }); }
    if (url.pathname === '/api/claude' && req.method === 'POST') {
      if (!/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'JSON only.' });
      try { return json(res, 200, await callClaude(JSON.parse(await readBody(req, 40 * 1024 * 1024)))); }
      catch (e) { return json(res, 400, { error: 'Bad request: ' + (e.message || e) }); }
    }
    return json(res, 404, { error: 'Not found' });
  }
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
};
/* If the port is taken (another copy of this server, or a preview), step up to the next free one. */
let port = +process.argv[2] || 8766;
const server = createServer(handler);
server.on('error', (e) => { if (e.code === 'EADDRINUSE' && port < 8776) { port++; server.listen(port, '127.0.0.1'); } else throw e; });
server.on('listening', () => console.log(`Birthday Bash on http://localhost:${port}/builder.html\nClaude subscription bridge: ${CLI}`));
server.listen(port, '127.0.0.1');
