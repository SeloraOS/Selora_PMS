import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/shared/ThemeToggle';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  background: '#171717',
  border: '1px solid #2b2b2b',
  borderRadius: '6px',
  color: '#f8f8f8',
  fontSize: '13px',
  outline: 'none',
};

const ALLOW_SIGNUP = import.meta.env.VITE_ALLOW_SIGNUP === 'true'; // accounts are normally created by invitation

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
  // Optional prefill for demo/dev, set VITE_DEMO_EMAIL / VITE_DEMO_PASSWORD in .env.local
  const [email, setEmail] = useState(import.meta.env.VITE_DEMO_EMAIL || '');
  const [password, setPassword] = useState(import.meta.env.VITE_DEMO_PASSWORD || '');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/projects" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const { data, error: err } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password, fullName);
    setBusy(false);
    if (err) return setError(err.message);
    if (mode === 'signup' && !data.session) setInfo('Account created. Check your email to confirm, then sign in.');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', padding: '16px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}><ThemeToggle /></div>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '340px', background: '#0f0f0f', border: '1px solid #1c1c1c', borderRadius: '10px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', background: '#0289f7', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Folder size={17} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8f8f8' }}>Selora PMS</div>
            <div style={{ fontSize: '11px', color: '#7c7c7c' }}>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</div>
          </div>
        </div>

        {mode === 'signup' && (
          <input style={inputStyle} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        )}
        <input style={inputStyle} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

        {error && <div style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
        {info && <div style={{ fontSize: '12px', color: '#22c55e' }}>{info}</div>}

        <button type="submit" disabled={busy} style={{ padding: '9px', background: '#0289f7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {ALLOW_SIGNUP && <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: '#7c7c7c', fontSize: '12px', cursor: 'pointer' }}>
          {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
        </button>}
        {!ALLOW_SIGNUP && <div style={{ fontSize: '11px', color: '#7c7c7c', textAlign: 'center' }}>Accounts are created by invitation. Ask your administrator.</div>}
      </form>
    </div>
  );
}
