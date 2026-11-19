import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './AuthForm.jsx';
import StockTable, { Change } from './StockTable.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [countries, setCountries] = useState([]);
  const [code, setCode] = useState('US');
  const [market, setMarket] = useState(null);
  const [error, setError] = useState('');
  const [watch, setWatch] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [alertSym, setAlertSym] = useState(null);
  const [target, setTarget] = useState('');

  useEffect(() => {
    api('/countries').then(setCountries).catch((e) => setError(e.message));
    api('/me').then(setUser).catch(() => {});
  }, []);

  const loadMarket = useCallback(() => {
    api('/market/' + code).then((m) => { setMarket(m); setError(''); }).catch((e) => setError(e.message));
  }, [code]);

  useEffect(() => {
    setMarket(null);
    loadMarket();
    const t = setInterval(loadMarket, 20000);
    return () => clearInterval(t);
  }, [loadMarket]);

  const loadUserData = useCallback(async () => {
    if (!user) { setWatch([]); setAlerts([]); return; }
    try {
      const fired = await api('/alerts/check', 'POST');
      if (fired.length) setNotes((n) => [...fired.map((a) => `${a.symbol} is ${a.direction === 'above' ? 'above' : 'below'} ${a.target} (now ${a.price})`), ...n]);
      setWatch(await api('/watchlist'));
      setAlerts(await api('/alerts'));
    } catch (e) { setError(e.message); }
  }, [user]);

  useEffect(() => {
    loadUserData();
    if (!user) return;
    const t = setInterval(loadUserData, 20000);
    return () => clearInterval(t);
  }, [loadUserData, user]);

  const watched = new Set(watch.map((w) => w.symbol));

  async function toggle(symbol) {
    try {
      if (watched.has(symbol)) await api('/watchlist/' + encodeURIComponent(symbol), 'DELETE');
      else await api('/watchlist', 'POST', { symbol });
      setWatch(await api('/watchlist'));
    } catch (e) { setError(e.message); }
  }

  async function addAlert(e) {
    e.preventDefault();
    try {
      await api('/alerts', 'POST', { symbol: alertSym.symbol, target: Number(target) });
      setAlertSym(null); setTarget('');
      loadUserData();
    } catch (x) { setError(x.message); }
  }

  async function delAlert(id) {
    await api('/alerts/' + id, 'DELETE');
    setAlerts(await api('/alerts'));
  }

  async function logout() {
    await api('/auth/logout', 'POST');
    setUser(null);
  }

  return (
    <div className="wrap">
      <header>
        <h1>🌍 World Stocks</h1>
        {user ? (
          <span>{user.email} <button onClick={logout}>Sign out</button></span>
        ) : (
          <button onClick={() => setShowAuth(!showAuth)}>Sign in / Sign up</button>
        )}
      </header>

      {notes.length > 0 && (
        <div className="notes" role="status">
          {notes.map((n, i) => <p key={i}>🔔 {n}</p>)}
          <button onClick={() => setNotes([])}>Dismiss</button>
        </div>
      )}
      {error && <p className="err" role="alert">{error}</p>}
      {!user && showAuth && <AuthForm onUser={(u) => { setUser(u); setShowAuth(false); }} />}

      <section className="card">
        <label>Country
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        {!market ? <p>Loading…</p> : (
          <>
            <h2>{market.name} — {market.exchange}</h2>
            <p>Index {market.index.symbol}: <strong>{market.index.price?.toLocaleString() ?? '—'}</strong> <Change q={market.index} /></p>
            {market.stocks.some((s) => !s.live) && <p className="muted">Some prices could not be fetched live right now.</p>}
            <StockTable stocks={market.stocks} user={user} watched={watched} onToggle={toggle} onAlert={setAlertSym} />
            <p className="muted">Updated {new Date(market.updated).toLocaleTimeString()} · refreshes every 20s · data may be delayed</p>
          </>
        )}
      </section>

      {alertSym && (
        <form className="card" onSubmit={addAlert}>
          <h3>Price alert for {alertSym.name}</h3>
          <label>Target price<input type="number" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required /></label>
          <button type="submit">Create alert</button> <button type="button" onClick={() => setAlertSym(null)}>Cancel</button>
        </form>
      )}

      {user && (
        <>
          <section className="card">
            <h2>My watchlist</h2>
            {watch.length === 0 ? <p>Nothing yet. Use “Watch” on a stock above.</p> : (
              <StockTable stocks={watch} user={user} watched={watched} onToggle={toggle} />
            )}
          </section>
          <section className="card">
            <h2>My alerts</h2>
            {alerts.length === 0 ? <p>No alerts.</p> : (
              <ul>
                {alerts.map((a) => (
                  <li key={a.id}>
                    {a.symbol} {a.direction} {a.target} {a.triggered ? '— ✅ triggered' : '— waiting'}{' '}
                    <button aria-label={`Delete alert for ${a.symbol}`} onClick={() => delAlert(a.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
