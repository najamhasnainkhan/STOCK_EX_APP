import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { COUNTRIES, getQuotes, findName } from './quotes.js';

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET = process.env.SESSION_SECRET || '';
const attempts = new Map();

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  });

function auth(req, res, next) {
  try {
    req.userId = jwt.verify(req.cookies.session, SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in' });
  }
}

function setSession(req, res, user) {
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https', maxAge: 7 * 864e5 });
}

function throttle(key) {
  const a = attempts.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
  a.n++;
  attempts.set(key, a);
  return a.n > 10;
}

app.get('/api/countries', (req, res) => {
  res.json(Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name, exchange: c.exchange })));
});

app.get('/api/market/:code', wrap(async (req, res) => {
  const c = COUNTRIES[req.params.code];
  if (!c) return res.status(404).json({ error: 'Unknown country' });
  const [idx, ...quotes] = await getQuotes([c.index, ...Object.keys(c.stocks)]);
  res.json({
    code: req.params.code, name: c.name, exchange: c.exchange, index: idx,
    stocks: quotes.map((q) => ({ ...q, name: c.stocks[q.symbol] })),
    updated: new Date().toISOString(),
  });
}));

app.post('/api/auth/:mode(signup|login)', wrap(async (req, res) => {
  if (!SECRET) return res.status(500).json({ error: 'SESSION_SECRET is not set' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6)
    return res.status(400).json({ error: 'Enter a valid email and a password of 6+ characters' });
  if (throttle(email + req.ip)) return res.status(429).json({ error: 'Too many attempts, try later' });
  if (req.params.mode === 'signup') {
    const hash = await bcrypt.hash(password, 10);
    try {
      const r = await query('insert into users(email,password_hash) values($1,$2) returning id,email', [email, hash]);
      setSession(req, res, r.rows[0]);
      return res.json(r.rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      throw e;
    }
  }
  const r = await query('select id,email,password_hash from users where email=$1', [email]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  setSession(req, res, u);
  res.json({ id: u.id, email: u.email });
}));

app.post('/api/auth/logout', (req, res) => { res.clearCookie('session'); res.json({ ok: true }); });

app.get('/api/me', wrap(async (req, res) => {
  try {
    const id = jwt.verify(req.cookies.session, SECRET).id;
    const r = await query('select id,email from users where id=$1', [id]);
    res.json(r.rows[0] || null);
  } catch { res.json(null); }
}));

app.get('/api/watchlist', auth, wrap(async (req, res) => {
  const r = await query('select symbol,name,country from watchlist where user_id=$1 order by id', [req.userId]);
  const qs = await getQuotes(r.rows.map((x) => x.symbol));
  res.json(r.rows.map((x, i) => ({ ...x, ...qs[i], name: x.name })));
}));

app.post('/api/watchlist', auth, wrap(async (req, res) => {
  const info = findName(String(req.body.symbol));
  if (!info) return res.status(400).json({ error: 'Unknown symbol' });
  await query('insert into watchlist(user_id,symbol,name,country) values($1,$2,$3,$4) on conflict do nothing', [req.userId, req.body.symbol, info.name, info.country]);
  res.json({ ok: true });
}));

app.delete('/api/watchlist/:symbol', auth, wrap(async (req, res) => {
  await query('delete from watchlist where user_id=$1 and symbol=$2', [req.userId, req.params.symbol]);
  res.json({ ok: true });
}));

app.get('/api/alerts', auth, wrap(async (req, res) => {
  const r = await query('select id,symbol,target::float as target,direction,triggered from alerts where user_id=$1 order by id desc', [req.userId]);
  res.json(r.rows);
}));

app.post('/api/alerts', auth, wrap(async (req, res) => {
  const symbol = String(req.body.symbol);
  const target = Number(req.body.target);
  if (!findName(symbol) || !(target > 0)) return res.status(400).json({ error: 'Pick a stock and a positive target' });
  const [q] = await getQuotes([symbol]);
  if (q.price == null) return res.status(503).json({ error: 'Price unavailable right now' });
  const direction = target >= q.price ? 'above' : 'below';
  await query('insert into alerts(user_id,symbol,target,direction) values($1,$2,$3,$4)', [req.userId, symbol, target, direction]);
  res.json({ ok: true });
}));

app.delete('/api/alerts/:id', auth, wrap(async (req, res) => {
  await query('delete from alerts where user_id=$1 and id=$2', [req.userId, Number(req.params.id)]);
  res.json({ ok: true });
}));

// Checks pending alerts against live prices; returns the ones that just fired.
app.post('/api/alerts/check', auth, wrap(async (req, res) => {
  const r = await query('select id,symbol,target::float as target,direction from alerts where user_id=$1 and not triggered', [req.userId]);
  const qs = await getQuotes([...new Set(r.rows.map((a) => a.symbol))]);
  const px = Object.fromEntries(qs.map((q) => [q.symbol, q.price]));
  const fired = r.rows.filter((a) => px[a.symbol] != null && (a.direction === 'above' ? px[a.symbol] >= a.target : px[a.symbol] <= a.target));
  for (const a of fired) await query('update alerts set triggered=true where id=$1', [a.id]);
  res.json(fired.map((a) => ({ ...a, price: px[a.symbol] })));
}));

app.listen(process.env.API_PORT || 3001, () => console.log('API ready'));
