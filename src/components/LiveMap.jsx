import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, Polyline } from 'react-leaflet'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { distanciaHaversine, calcularETA, estaAcercando } from '../utils/geolocalizacion'

function CenterMap({ pos }) {
  const map = useMap()
  useEffect(() => {
    if (!pos) return
    try { map.setView([pos.lat, pos.lng], 15) } catch (e) {}
  }, [pos, map])
  return null
}

function FitBounds({ points = [] }) {
  const map = useMap()
  useEffect(() => {
    const pts = points.filter(Boolean)
    if (!pts.length) return
    try {
      const latlngs = pts.map(p => [p.lat, p.lng])
      map.fitBounds(latlngs, { padding: [40, 40] })
    } catch (e) {
      // ignore
    }
  }, [points, map])
  return null
}

export default function LiveMap({ vehicleId = import.meta.env.VITE_PUBLIC_VEHICLE_ID || 'bus-1', height = 180 }){
  const [pos, setPos] = useState(null)
  const [velocidad, setVelocidad] = useState(null)
  const [positions, setPositions] = useState([]) // últimas posiciones del bus
  const [studentPos, setStudentPos] = useState(null)
  const [ubicacionActivo, setUbicacionActivo] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [historialDistancias, setHistorialDistancias] = useState([])

  useEffect(() => {
    if (!vehicleId) return
    const col = collection(db, `vehicles/${vehicleId}/positions`)
    // pedimos últimas 5 posiciones para dibujar historial y estimar velocidad si hace falta
    const q = query(col, orderBy('ts', 'desc'), limit(5))
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) return (setPos(null), setPositions([]), setVelocidad(null))
      const docs = snap.docs
      const parsed = docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          lat: data.lat,
          lng: data.lng,
          velocidad: data.velocidad ?? null,
          ts: data.ts?.toDate?.() ?? null,
        }
      })
      setPositions(parsed)
      // primera entrada es la más reciente
      const latest = parsed[0]
      setPos(latest ? { lat: latest.lat, lng: latest.lng, ts: latest.ts } : null)

      // determinar velocidad: preferir la proporcionada por el ping, sino estimar por diferencia entre las dos primeras posiciones
      if (latest && latest.velocidad != null) {
        setVelocidad(latest.velocidad)
      } else if (parsed.length > 1 && parsed[0].ts && parsed[1].ts) {
        const p0 = parsed[0]
        const p1 = parsed[1]
        const dt = (p0.ts.getTime() - p1.ts.getTime()) / 1000 // segundos
        if (dt > 0) {
          const d = distanciaHaversine(p0.lat, p0.lng, p1.lat, p1.lng)
          const v = d / dt
          setVelocidad(Number(v.toFixed(2)))
        }
      } else {
        setVelocidad(null)
      }
    }, err => {
      console.error('LiveMap snapshot error', err)
    })
    return () => unsub()
  }, [vehicleId])

  // actualizar historial de distancias cuando cambie la posición del bus o del estudiante
  useEffect(() => {
    if (!pos || !studentPos) return
    const d = distanciaHaversine(pos.lat, pos.lng, studentPos.lat, studentPos.lng)
    setHistorialDistancias(h => {
      const nuevo = [...h, d]
      if (nuevo.length > 10) nuevo.shift()
      return nuevo
    })
  }, [pos, studentPos])

  const activarUbicacion = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocalización no soportada en este navegador')
      return
    }
    setErrorMsg(null)
    setUbicacionActivo(true)

    const geo = navigator.geolocation
    try {
      // Si el entorno provee watchPosition como función, úsala
      const watchFn = geo && geo.watchPosition
      if (typeof watchFn === 'function') {
        try {
          // call directly; if environment misbehaves la llamada caerá al catch y usaremos el fallback
          const watcher = geo.watchPosition((p) => {
            setStudentPos({ lat: p.coords.latitude, lng: p.coords.longitude })
          }, (err) => {
            setErrorMsg(err.message || 'Error al obtener ubicación')
            setUbicacionActivo(false)
          }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 })
          (window.__unibus_geowatcher__ = window.__unibus_geowatcher__ || ({})).watcher = watcher
        } catch (callErr) {
          console.warn('watchPosition call failed, falling back to getCurrentPosition polling', callErr)
          // si falla la llamada, intentar fallback abajo (se hace nada aquí para que el flujo continúe)
        }
      } else if (typeof geo.getCurrentPosition === 'function') {
      // Fallback: obtener posición periódicamente con getCurrentPosition
      const updateOnce = () => {
        geo.getCurrentPosition((p) => {
          setStudentPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        }, (err) => {
          setErrorMsg(err.message || 'Error al obtener ubicación')
          setUbicacionActivo(false)
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 })
      }
      updateOnce()
      const poller = setInterval(updateOnce, 5000)
      (window.__unibus_geowatcher__ = window.__unibus_geowatcher__ || ({})).poller = poller
      } else {
        setErrorMsg('API de geolocalización incompleta en este entorno')
        setUbicacionActivo(false)
      }
    } catch (err) {
      console.error('activarUbicacion error', err)
      setErrorMsg('Error al activar geolocalización: ' + (err && err.message ? err.message : String(err)))
      setUbicacionActivo(false)
    }
  }

  const desactivarUbicacion = () => {
    setUbicacionActivo(false)
    if (window.__unibus_geowatcher__) {
      if (window.__unibus_geowatcher__.watcher) {
        try { navigator.geolocation.clearWatch(window.__unibus_geowatcher__.watcher) } catch(e){}
        delete window.__unibus_geowatcher__.watcher
      }
      if (window.__unibus_geowatcher__.poller) {
        clearInterval(window.__unibus_geowatcher__.poller)
        delete window.__unibus_geowatcher__.poller
      }
    }
    setStudentPos(null)
    setHistorialDistancias([])
    setErrorMsg(null)
  }

  // recalculamos distancia directa y ETA con la velocidad estimada/proporcionada
  const distanciaActual = (pos && studentPos) ? distanciaHaversine(pos.lat, pos.lng, studentPos.lat, studentPos.lng) : null
  const etaSegundos = (distanciaActual && velocidad) ? calcularETA(distanciaActual, velocidad) : null
  const estado = estaAcercando(historialDistancias, 1)

  return (
    <div className="panel" style={{ padding: 8 }}>
      <h4 style={{marginTop:0}}>Mini mapa (posición real)</h4>
      <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={[14.95, -89.53]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          {positions && positions.length > 0 && (
            <Polyline positions={positions.map(p => [p.lat, p.lng])} pathOptions={{ color: '#f97316', weight: 3, opacity: 0.6 }} />
          )}
          {pos && <CircleMarker center={[pos.lat, pos.lng]} pathOptions={{ color: '#ef4444' }} radius={8} />}
          {studentPos && <CircleMarker center={[studentPos.lat, studentPos.lng]} pathOptions={{ color: '#059669' }} radius={6} />}
          {/* línea directa bus -> alumno */}
          {pos && studentPos && (
            <Polyline positions={[[pos.lat, pos.lng], [studentPos.lat, studentPos.lng]]} pathOptions={{ color: '#60a5fa', dashArray: '6', weight: 2 }} />
          )}
          <CenterMap pos={pos} />
          <FitBounds points={[pos, studentPos]} />
        </MapContainer>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        {!ubicacionActivo ? (
          <button className="btn" onClick={activarUbicacion}>Activar mi ubicación</button>
        ) : (
          <button className="btn secondary" onClick={desactivarUbicacion}>Desactivar ubicación</button>
        )}
        <div style={{ fontSize: 13, color: '#374151' }}>{errorMsg}</div>
      </div>

      <div style={{marginTop:8,fontSize:12,color:'#374151'}}>
        {pos ? `Última posición bus: ${pos.ts ? pos.ts.toISOString() : '—'}` : 'Sin datos del bus aún'}
      </div>

      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="panel">
          <div><strong>Distancia</strong></div>
          <div>{distanciaActual ? `${(distanciaActual).toFixed(0)} m (${(distanciaActual/1000).toFixed(3)} km)` : '—'}</div>
        </div>
        <div className="panel">
          <div><strong>ETA</strong></div>
          <div>{etaSegundos ? `${Math.round(etaSegundos/60)} min (${Math.round(etaSegundos)} s)` : '— (velocidad no disponible)'}</div>
        </div>
      </div>

      <div style={{ marginTop: 8 }} className="panel">
        <div><strong>Estado</strong></div>
        <div>{estado}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>Velocidad del bus: {velocidad ? `${velocidad} m/s` : '—'}</div>
      </div>
    </div>
  )
}
