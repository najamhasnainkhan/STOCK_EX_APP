import React, { useState } from 'react';
import { api } from './api.js';

export default function AuthForm({ onUser }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      onUser(await api('/auth/' + mode, 'POST', { email, password }));
    } catch (x) {
      setErr(x.message);
    }
  }

  return (
    <form className="card auth" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="submit">{mode === 'login' ? 'Sign in' : 'Sign up'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}
