import React, { useEffect, useState } from 'react'
import { FiHome, FiUsers, FiCheckSquare } from 'react-icons/fi'
import PublicForm from './pages/PublicForm'
import AdminRoster from './pages/AdminRoster'
import AdminAttendance from './pages/AdminAttendance'

export default function App(){
  const [route, setRoute] = useState(window.location.hash || '#/')

  useEffect(()=>{
    const onHash = () => setRoute(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  },[])

  return (
    <div className="app">
      <header className="panel page-hero" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h1 style={{margin:0}}>UniBus</h1>
          <div className="subtitle" style={{marginTop:4}}>Gestión de inscripciones y asistencia</div>
        </div>
        <nav className="nav-links" aria-label="Principal">
          <a href="#/" className={route === '#/' ? 'active' : ''} aria-current={route === '#/' ? 'page' : undefined}>
            <span className="nav-link-inner"><FiHome className="icon"/>Formulario público</span>
          </a>
          <a href="#/admin" className={route === '#/admin' ? 'active' : ''} aria-current={route === '#/admin' ? 'page' : undefined}>
            <span className="nav-link-inner"><FiUsers className="icon"/>Roster admin</span>
          </a>
          <a href="#/admin/attendance" className={route === '#/admin/attendance' ? 'active' : ''} aria-current={route === '#/admin/attendance' ? 'page' : undefined}>
            <span className="nav-link-inner"><FiCheckSquare className="icon"/>Pasar lista</span>
          </a>
        </nav>
      </header>

      <main>
        <div id="content">
          {route === '#/admin/attendance' ? <AdminAttendance/> : (route === '#/admin' ? <AdminRoster/> : <PublicForm/>)}
        </div>
      </main>

      <footer className="panel footer" style={{marginTop:18,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{color: 'var(--muted)', fontWeight:600}}>
          UniBus Zacapa
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <a href="https://wa.me/50257833960" target="_blank" rel="noreferrer" style={{color:'var(--muted)',fontWeight:600}}>Contacto</a>
        </div>
      </footer>
    </div>
  )
}
