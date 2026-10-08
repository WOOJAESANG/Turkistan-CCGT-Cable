import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, LangToggle } from '../lib/i18n'

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
    if (error) setErr(error.message || t('Login failed'))
    // on success, App's onAuthStateChange handler will route to the dashboard
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <LangToggle className="login-lang" />
        <div className="login-brand">
          <div className="login-title">Turkistan CCGT</div>
          <div className="login-sub">{t('Cable Management System')}</div>
        </div>

        <label className="login-label">{t('Email')}</label>
        <input
          className="login-input"
          type="email"
          autoComplete="username"
          placeholder="company@turkistan.local"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <label className="login-label">{t('Password')}</label>
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
          {busy ? t('Signing in…') : t('Sign in')}
        </button>

        <p className="login-foot">
          {t('No account? Contact the administrator.')}
        </p>
      </form>
    </div>
  )
}
