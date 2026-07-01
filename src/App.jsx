import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { fetchAllFieldData, fetchAllDaily, fetchAllVendors, subscribeRealtime, unsubscribeRealtime, resetCaches, setCurrentEmail } from './lib/dataStore'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CableSchedule from './components/CableSchedule'
import CableMaterial from './components/CableMaterial'
import CableActuals from './components/CableActuals'
import DailyReport from './components/DailyReport'
import Settings from './components/Settings'
import Login from './components/Login'

function App() {
  const [page, setPage] = useState('dashboard')
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Fetch + subscribe when logged in; reset on logout
  useEffect(() => {
    if (!session) { setCurrentEmail(null); resetCaches(); unsubscribeRealtime(); return }
    setCurrentEmail(session.user?.email)
    fetchAllFieldData()
    fetchAllDaily()
    fetchAllVendors()
    subscribeRealtime()
    return () => { /* keep subscription across page nav */ }
  }, [session])

  if (!authChecked) return <div className="boot-loading">Loading…</div>
  if (!session) return <Login />

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-hamburger"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />}
      <Sidebar
        activePage={page}
        onNavigate={p => { setPage(p); setMobileOpen(false) }}
        session={session}
        mobileOpen={mobileOpen}
      />
      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'schedule' && <CableSchedule />}
        {page === 'material' && <CableMaterial />}
        {page === 'actuals' && <CableActuals />}
        {page === 'daily' && <DailyReport />}
        {page === 'settings' && session?.user?.user_metadata?.role === 'admin' && <Settings session={session} />}
      </main>
    </div>
  )
}

export default App
