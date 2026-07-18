import { supabase } from '../lib/supabase'

export function isAdmin(session) {
  return session?.user?.user_metadata?.role === 'admin'
}

export function isViewer(session) {
  return session?.user?.user_metadata?.role === 'viewer'
}

export default function Sidebar({ activePage, onNavigate, session, mobileOpen, collapsed, onToggleCollapse }) {
  const admin = isAdmin(session)
  const viewer = isViewer(session)
  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!collapsed && (
          <>
            <h1>Turkistan CCGT</h1>
            <span>Cable Management</span>
          </>
        )}
        <button className="sidebar-toggle" onClick={onToggleCollapse} title={collapsed ? 'Show menu' : 'Hide menu'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              : <><polyline points="11 17 6 12 11 7" /><line x1="18" y1="12" x2="6" y2="12" /></>
            }
          </svg>
        </button>
      </div>
      <nav className="sidebar-nav">
        <button className={`nav-item${activePage === 'dashboard' ? ' active' : ''}`} onClick={() => onNavigate('dashboard')} title="Dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          {!collapsed && 'Dashboard'}
        </button>
        {admin && (
          <button className={`nav-item${activePage === 'masterplan' ? ' active' : ''}`} onClick={() => onNavigate('masterplan')} title="Cable Master Plan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 15l4-6 4 3 5-8" />
            </svg>
            {!collapsed && <><span>Cable Master Plan</span><span className="nav-admin-badge">Admin</span></>}
          </button>
        )}
        <button className={`nav-item${activePage === 'schedule' ? ' active' : ''}`} onClick={() => onNavigate('schedule')} title="Cable Schedule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
          {!collapsed && 'Cable Schedule'}
        </button>
        <button className={`nav-item${activePage === 'material' ? ' active' : ''}`} onClick={() => onNavigate('material')} title="Cable Material">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          {!collapsed && 'Cable Material'}
        </button>
        <button className={`nav-item${activePage === 'actuals' ? ' active' : ''}`} onClick={() => onNavigate('actuals')} title="Work Log">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1z" />
            <path d="M9 4h6" />
            <path d="m9 14 2 2 4-4" />
          </svg>
          {!collapsed && 'Work Log'}
        </button>
        <button className={`nav-item${activePage === 'daily' ? ' active' : ''}`} onClick={() => onNavigate('daily')} title="Daily Report">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
          </svg>
          {!collapsed && 'Daily Report'}
        </button>
        {admin && (
          <button className={`nav-item${activePage === 'settings' ? ' active' : ''}`} onClick={() => onNavigate('settings')} title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            {!collapsed && <><span>Settings</span><span className="nav-admin-badge">Admin</span></>}
          </button>
        )}
      </nav>
      {!collapsed && (
        <div className="sidebar-footer">
          {session?.user?.email && (
            <div className="sidebar-user">
              <div className="sidebar-user-label">Signed in</div>
              <div className="sidebar-user-email" title={session.user.email}>{session.user.email}</div>
              {viewer && <span className="sidebar-viewer-badge">View Only</span>}
              <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          )}
          <p>Turkistan CCGT Project</p>
          <p>v1.0.0</p>
        </div>
      )}
      {collapsed && (
        <div className="sidebar-footer-collapsed">
          <button className="sidebar-signout-icon" onClick={() => supabase.auth.signOut()} title="Sign out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  )
}
