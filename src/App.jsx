import React, { useEffect, useState } from 'react'
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
      <header>
        <h1>UniBus</h1>
        <nav>
          <a href="#/">Formulario público</a> |
          <a href="#/admin">Roster admin</a> |
          <a href="#/admin/attendance">Pasar lista</a>
        </nav>
      </header>

      <main>
        <div id="content">
          {route === '#/admin/attendance' ? <AdminAttendance/> : (route === '#/admin' ? <AdminRoster/> : <PublicForm/>)}
        </div>
      </main>

      <footer>
      </footer>
    </div>
  )
}
