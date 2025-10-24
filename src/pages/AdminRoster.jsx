import React, { useEffect, useState, useMemo } from 'react'
import { auth, db } from '../firebase'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { FiLogOut, FiSearch, FiChevronLeft, FiChevronRight, FiAlertCircle } from 'react-icons/fi'

export default function AdminRoster(){
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filterUniversity, setFilterUniversity] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterReturnTime, setFilterReturnTime] = useState('')
  
  const [page, setPage] = useState(0)
  const [hideLess, setHideLess] = useState(false)
  const [noteModal, setNoteModal] = useState(null)
  const PAGE_SIZE = 10

  useEffect(()=>{
    const unsubscribeAuth = auth.onAuthStateChanged(u=>{
      setUser(u)
    })
    return unsubscribeAuth
  },[])

  useEffect(()=>{
    if(!user) return
    setLoading(true)
    const q = query(collection(db, 'registrations'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>{
      const data = snap.docs.map(d=>({ id:d.id, ...d.data() }))
      setRows(data)
      setLoading(false)
      setError(null)
    }, err=>{
      console.error('Error loading registrations:', err)
      setError(err.message || 'Error al cargar registros')
      setLoading(false)
    })
    return unsub
  },[user])

  const handleLogin = async e =>{
    e.preventDefault()
    try{
      await signInWithEmailAndPassword(auth, email, password)
    }catch(err){
      alert('Error al iniciar sesión: '+err.message)
    }
  }

  const handleLogout = async ()=>{
    await signOut(auth)
  }
  

  

  const updateField = async (id, patch) =>{
    try{
      const ref = doc(db, 'registrations', id)
      await updateDoc(ref, patch)
    }catch(err){
      console.error('updateField error', err)
      // show more info to help debugging (will display Firebase error code/message)
      const msg = (err && (err.code || err.message)) ? `${err.code || ''} ${err.message || ''}` : String(err)
      alert('Error al actualizar campo: ' + msg)
    }
  }


  if(!user){
    return (
      <section className="panel">
        <div className="header">
          <div>
            <h2 className="title">Admin — Iniciar sesión</h2>
            <div className="subtitle">Accede con tu cuenta de administrador</div>
          </div>
        </div>
        <form onSubmit={handleLogin} className="form">
          <label>Correo
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <label>Contraseña
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          <button type="submit" className="btn">Ingresar</button>
        </form>
        <p className="note">Crear el usuario admin desde la consola de Firebase (Authentication) y usa ese correo aquí.</p>
      </section>
    )
  }
  if(error){
    return (
      <section className="panel">
        <h2>Roster — Admin</h2>
        <p className="note">Error al cargar registros: {error}</p>
        <p className="note">Asegúrate de haber iniciado sesión y de que las reglas de Firestore permiten lectura para usuarios autenticados.</p>
        <p className="note">Usuario: {user?.email} <button className="btn secondary" onClick={handleLogout}>Cerrar sesión</button></p>
      </section>
    )
  }
  return (
    <section className="panel roster-panel">
      <div className="header">
        <div>
          <h2 className="title">Roster — Admin</h2>
          <div className="subtitle">Bienvenido: {user.email}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn secondary" onClick={handleLogout} title="Cerrar sesión">
            <span style={{display:'inline-flex',alignItems:'center',gap:8}}><FiLogOut />Cerrar sesión</span>
          </button>
        </div>
      </div>
      <div className="controls">
        <div style={{position:'relative',display:'inline-flex',alignItems:'center'}}>
          <FiSearch style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}} />
          <input className="input" placeholder="Buscar por nombre o apellido" value={search} onChange={e=>{setSearch(e.target.value); setPage(0)}} style={{paddingLeft:36}} />
        </div>
        <select className="input" value={filterUniversity} onChange={e=>{setFilterUniversity(e.target.value); setPage(0)}}>
          <option value="">Todas las universidades</option>
          {[...new Set(rows.map(r=>r.university).filter(Boolean))].map(u=> <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="input" value={filterLocation} onChange={e=>{setFilterLocation(e.target.value); setPage(0)}}>
          <option value="">Todos los lugares</option>
          {[...new Set(rows.map(r=>r.boardingLocation || r.otherLocation).filter(Boolean))].map(l=> <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="input" value={filterReturnTime} onChange={e=>{setFilterReturnTime(e.target.value); setPage(0)}}>
          <option value="">Todas las vueltas</option>
          {[...new Set(rows.map(r=>r.returnTime).filter(Boolean))].map(t=> <option key={t} value={t}>{t}</option>)}
        </select>
        {/* filtro de pagado eliminado */}
        <label style={{display:'inline-flex',alignItems:'center',gap:6}}>
          <input type="checkbox" checked={hideLess} onChange={e=>setHideLess(e.target.checked)} />
          <span className="note">Vista compacta</span>
        </label>
      </div>

  {loading && <p>Cargando registros...</p>}

  <div className={"table-wrap" + (hideLess ? ' hide-less' : '')}>
  <table className="roster">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th className="col-university">Universidad</th>
            <th className="col-phone">Teléfono</th>
            <th>Vuelta</th>
            <th>Lugar</th>
            <th>Tipo de viaje</th>
          </tr>
        </thead>
        <tbody>
          {/** Apply filters and pagination client-side **/}
          {(() => {
            const filtered = rows.filter(r=>{
              const q = (search||'').toLowerCase()
              if(q){
                const full = ((r.firstName||'')+' '+(r.lastName||'')).toLowerCase()
                if(!full.includes(q)) return false
              }
              if(filterUniversity && r.university !== filterUniversity) return false
              const place = r.boardingLocation || r.otherLocation || ''
              if(filterLocation && place !== filterLocation) return false
              if(filterReturnTime && r.returnTime !== filterReturnTime) return false
              return true
            })

            const start = page * PAGE_SIZE
            const pageRows = filtered.slice(start, start + PAGE_SIZE)

            return pageRows.map(r=> (
              <tr key={r.id} className={r.notes ? 'has-note' : ''}>
                <td>
                  {r.firstName}
                    {r.notes ? (
                      <button
                        className="note-icon"
                        title={r.notes}
                        aria-label="Observación"
                        onClick={()=>setNoteModal(r)}
                      >
                        <FiAlertCircle />
                      </button>
                    ) : null}
                </td>
                <td>{r.lastName}</td>
                <td className="col-university">{r.university}</td>
                <td className="col-phone">{r.phone}</td>
                <td>{r.returnTime}</td>
                <td>{r.boardingLocation || r.otherLocation}</td>
                <td>
                  <select defaultValue={r.tripType || 'ida'} onChange={e=> {
                    const newType = e.target.value
                    updateField(r.id, { tripType: newType })
                  }}>
                    <option value="ida">Solo ida</option>
                    <option value="ida_vuelta">Ida y vuelta</option>
                    <option value="vuelta">Solo vuelta</option>
                  </select>
                </td>
              </tr>
            ))
          })()}
        </tbody>
  </table>
  </div>

      {/* pagination controls */}
      <div style={{marginTop:10}}>
  <button className="btn ghost" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} title="Anterior"><FiChevronLeft /></button>
  <span style={{margin:'0 8px'}}>Página {page+1}</span>
  <button className="btn ghost" onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE_SIZE >= rows.length} title="Siguiente"><FiChevronRight /></button>
      </div>
      {noteModal && (
        <div className="modal-overlay" onClick={()=>setNoteModal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`Observación de ${noteModal.firstName} ${noteModal.lastName}`} onClick={e=>e.stopPropagation()}>
            <h3>Observación — {noteModal.firstName} {noteModal.lastName}</h3>
            <div className="note-content">{noteModal.notes}</div>
            <button className="close" onClick={()=>setNoteModal(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </section>
  )
}
