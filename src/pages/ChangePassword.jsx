import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/shared/ThemeToggle';

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'var(--control-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-color)', fontSize: '13px', outline: 'none' };

/** Strong enough for a business app without being annoying: 10+ characters with a letter and a number. */
export const passwordProblem = (pw) => (pw.length < 10 ? 'Use at least 10 characters.' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Include at least one letter and one number.' : '');

export default function ChangePassword() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(pw) || (pw !== again ? 'The two passwords do not match.' : '');
    if (problem) return setError(problem);
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) { setBusy(false); return setError(err.message); }
    await supabase.rpc('clear_must_change_password');
    await refreshProfile();
    setBusy(false);
    navigate('/projects', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '16px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}><ThemeToggle /></div>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '360px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px', color: 'var(--text-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <KeyRound size={20} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Choose a new password</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{profile?.must_change_password ? 'You signed in with a temporary password. Set your own to continue.' : 'Update your password.'}</div>
          </div>
        </div>
        <input type="password" aria-label="New password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} style={input} autoFocus autoComplete="new-password" />
        <input type="password" aria-label="Repeat new password" placeholder="Repeat new password" value={again} onChange={(e) => setAgain(e.target.value)} style={input} autoComplete="new-password" />
        {error && <div role="alert" style={{ fontSize: '12px', color: '#ef4444' }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ padding: '9px', background: 'var(--gray-900)', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save password'}</button>
        <button type="button" onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Sign out</button>
      </form>
    </div>
  );
}
