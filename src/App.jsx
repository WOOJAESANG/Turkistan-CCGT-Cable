import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import CableSchedule from './components/CableSchedule'
import CableMaterial from './components/CableMaterial'
import CableActuals from './components/CableActuals'
import DailyReport from './components/DailyReport'

function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'schedule' && <CableSchedule />}
        {page === 'material' && <CableMaterial />}
        {page === 'actuals' && <CableActuals />}
        {page === 'daily' && <DailyReport />}
      </main>
    </div>
  )
}

export default App
