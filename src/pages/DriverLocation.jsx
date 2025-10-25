import React, { useState, useRef, useEffect } from 'react'
import { auth } from '../firebase'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import enviarPing from '../utils/gpsSender'

export default function DriverLocation() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [ultimoPing, setUltimoPing] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const watchIdRef = useRef(null)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUser(u))
    return unsub
  }, [])

  async function login(e) {
    e && e.preventDefault()
    setMensaje('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setMensaje('Sesión iniciada')
    } catch (err) {
      console.error(err)
      setMensaje('Error al iniciar sesión: ' + (err.message || err.code))
    }
  }

  async function cerrarSesion() {
    try {
      await signOut(auth)
      setMensaje('Sesión cerrada')
    } catch (err) {
      setMensaje('Error al salir: ' + err.message)
    }
  }

  function iniciarCompartir() {
    if (!user) { setMensaje('Debe iniciar sesión antes de compartir ubicación'); return }
    if (!navigator.geolocation) { setMensaje('Geolocalización no soportada por este navegador'); return }
    setMensaje('Solicitando permiso de ubicación...')
    const id = navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const velocidad = pos.coords.speed || null
      try {
        await enviarPing(null, lat, lng, velocidad, pos.coords.heading || null, { source: 'driver' })
        setUltimoPing(new Date().toISOString())
        setMensaje('Ping enviado')
      } catch (err) {
        console.error('Error enviarPing', err)
        setMensaje('Error enviando ping: ' + (err.message || err.code))
      }
    }, (err) => {
      console.error('watchPosition error', err)
      // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      if (err && err.code === 1) {
        setMensaje('Permiso de ubicación denegado. Asegúrate de permitir el acceso a la ubicación en el navegador y que la página esté cargada desde https o localhost.');
      } else if (err && err.code === 2) {
        setMensaje('Posición no disponible. Intenta de nuevo o verifica la señal GPS.');
      } else if (err && err.code === 3) {
        setMensaje('Timeout al obtener posición. Aumenta el timeout o comprueba la conexión.');
      } else {
        setMensaje('Error de geolocalización: ' + (err && err.message ? err.message : String(err)))
      }
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 })

    watchIdRef.current = id
    setCompartiendo(true)
  }

  function detenerCompartir() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setCompartiendo(false)
    setMensaje('Compartir detenido')
  }

  return (
    <div className="app" style={{maxWidth:900}}>
      <header className="panel page-hero">
        <h2>Driver - Compartir ubicación</h2>
      </header>

      <div style={{marginTop:12}}>
        {!user ? (
          <form onSubmit={login} className="panel" style={{display:'grid',gap:8}}>
            <label>Correo
              <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="driver@unibus.test" />
            </label>
            <label>Contraseña
              <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password123" />
            </label>
            <div style={{display:'flex',gap:8}}>
              <button className="btn" type="submit">Iniciar sesión</button>
            </div>
            <div className="note">Crea el usuario en Firebase Authentication antes de usar esto.</div>
          </form>
        ) : (
          <div className="panel">
            <div><strong>Autenticado como:</strong> {user.email} (uid: {user.uid})</div>
            <div style={{marginTop:8}}>
              {!compartiendo ? (
                <button className="btn" onClick={iniciarCompartir}>Compartir ubicación</button>
              ) : (
                <button className="btn secondary" onClick={detenerCompartir}>Detener compartir</button>
              )}
              <button className="btn ghost" style={{marginLeft:8}} onClick={cerrarSesion}>Cerrar sesión</button>
            </div>
            <div style={{marginTop:12}}>
              <div>Estado: {compartiendo ? 'Compartiendo' : 'No compartiendo'}</div>
              <div>Último ping: {ultimoPing || '—'}</div>
              <div style={{marginTop:8,color:'#6b7280'}}>{mensaje}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
