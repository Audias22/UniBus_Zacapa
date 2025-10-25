import React, { useEffect, useState } from 'react'
import { FiHome, FiUsers, FiCheckSquare, FiMapPin } from 'react-icons/fi'
import PublicForm from './pages/PublicForm'
import AdminRoster from './pages/AdminRoster'
import AdminAttendance from './pages/AdminAttendance'
import LiveMap from './components/LiveMap'
import DriverLocation from './pages/DriverLocation'

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
          <a href="#/geo" className={route === '#/geo' ? 'active' : ''} aria-current={route === '#/geo' ? 'page' : undefined}>
            <span className="nav-link-inner"><FiMapPin className="icon"/>Geo Map</span>
          </a>
          <a href="#/driver" className={route === '#/driver' ? 'active' : ''} aria-current={route === '#/driver' ? 'page' : undefined}>
            <span className="nav-link-inner"><FiMapPin className="icon"/>Driver</span>
          </a>
        </nav>
      </header>

      <main>
        <div id="content">
          {route === '#/geo' ? <LiveMap/> : (route === '#/driver' ? <DriverLocation/> : (route === '#/admin/attendance' ? <AdminAttendance/> : (route === '#/admin' ? <AdminRoster/> : <PublicForm/>)))}
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
