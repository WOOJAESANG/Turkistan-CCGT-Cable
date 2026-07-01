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
      <Sidebar activePage={page} onNavigate={setPage} session={session} />
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
