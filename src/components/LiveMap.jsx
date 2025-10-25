import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
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
  const [studentPos, setStudentPos] = useState(null)
  const [ubicacionActivo, setUbicacionActivo] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [historialDistancias, setHistorialDistancias] = useState([])

  useEffect(() => {
    if (!vehicleId) return
    const col = collection(db, `vehicles/${vehicleId}/positions`)
    const q = query(col, orderBy('ts', 'desc'), limit(1))
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) return setPos(null)
      const doc = snap.docs[0]
      const data = doc.data()
      if (!data) return setPos(null)
      setPos({ lat: data.lat, lng: data.lng, ts: data.ts?.toDate?.() ?? null })
      setVelocidad(data.velocidad ?? null)
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
        // use call to ensure correct receiver
        const watcher = watchFn.call(geo, (p) => {
          setStudentPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        }, (err) => {
          setErrorMsg(err.message || 'Error al obtener ubicación')
          setUbicacionActivo(false)
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 })
        (window.__unibus_geowatcher__ = window.__unibus_geowatcher__ || ({})).watcher = watcher
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

  const distanciaActual = (pos && studentPos) ? historialDistancias[historialDistancias.length - 1] ?? distanciaHaversine(pos.lat, pos.lng, studentPos.lat, studentPos.lng) : null
  const etaSegundos = (distanciaActual && velocidad) ? calcularETA(distanciaActual, velocidad) : null
  const estado = estaAcercando(historialDistancias, 1)

  return (
    <div className="panel" style={{ padding: 8 }}>
      <h4 style={{marginTop:0}}>Mini mapa (posición real)</h4>
      <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={[14.95, -89.53]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
          {pos && <CircleMarker center={[pos.lat, pos.lng]} pathOptions={{ color: '#ef4444' }} radius={8} />}
          {studentPos && <CircleMarker center={[studentPos.lat, studentPos.lng]} pathOptions={{ color: '#059669' }} radius={6} />}
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
