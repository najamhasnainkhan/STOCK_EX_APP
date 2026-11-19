import React from 'react';

const fmt = (n) => (n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

export function Change({ q }) {
  if (q.price == null) return <span>—</span>;
  return <span className={q.change >= 0 ? 'up' : 'down'}>{q.change >= 0 ? '▲' : '▼'} {fmt(q.change)} ({q.pct.toFixed(2)}%)</span>;
}

export default function StockTable({ stocks, user, watched, onToggle, onAlert }) {
  return (
    <table>
      <thead>
        <tr><th>Stock</th><th>Price</th><th>Change</th>{user && <th>Actions</th>}</tr>
      </thead>
      <tbody>
        {stocks.map((s) => (
          <tr key={s.symbol}>
            <td>{s.name} <small>{s.symbol}</small></td>
            <td>{fmt(s.price)} {s.currency}</td>
            <td><Change q={s} /></td>
            {user && (
              <td>
                <button aria-pressed={watched.has(s.symbol)} onClick={() => onToggle(s.symbol)}>
                  {watched.has(s.symbol) ? '★ Watching' : '☆ Watch'}
                </button>{' '}
                {onAlert && <button onClick={() => onAlert(s)}>Alert</button>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
