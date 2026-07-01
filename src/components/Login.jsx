import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async e => {
    e.preventDefault()
    setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(error.message || 'Login failed')
    // on success, App's onAuthStateChange handler will route to the dashboard
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-title">Turkistan CCGT</div>
          <div className="login-sub">Cable Management System</div>
        </div>

        <label className="login-label">Email</label>
        <input
          className="login-input"
          type="email"
          autoComplete="username"
          placeholder="company@turkistan.local"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <label className="login-label">Password</label>
        <input
          className="login-input"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {err && <div className="login-err">{err}</div>}

        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-foot">
          계정이 없으신가요? 관리자에게 문의하세요.
        </p>
      </form>
    </div>
  )
}
