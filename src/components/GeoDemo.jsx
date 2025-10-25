import React, { useEffect, useState, useRef } from 'react';
import {
  distanciaHaversine,
  calcularRumbo,
  estaAcercando,
  calcularETA,
  suavizarMediaMovil,
} from '../utils/geolocalizacion';

import { MapContainer, TileLayer, CircleMarker, Polyline, useMap } from 'react-leaflet';
import { enviarPing } from '../utils/gpsSender'

function FitBounds({ puntos }) {
  const map = useMap();
  useEffect(() => {
    if (!puntos || puntos.length === 0) return;
    const latlngs = puntos.map(p => [p.lat, p.lng]);
    try {
      map.fitBounds(latlngs, { padding: [40, 40] });
    } catch (e) {
      // ignore
    }
  }, [puntos, map]);
  return null;
}

// Componente de demostración: simula pings de un bus y calcula distancia/ETA/estado
export default function GeoDemo() {
  // Punto del alumno (destino)
  const [alumno, setAlumno] = useState({ lat: 14.952, lng: -89.529 });
  // Posición inicial del bus
  const [bus, setBus] = useState({ lat: 14.94, lng: -89.54 });
  const [historialDistancias, setHistorialDistancias] = useState([]);
  const [velocidad, setVelocidad] = useState(0); // m/s
  const [estado, setEstado] = useState('desconocido');
  const intervaloRef = useRef(null);

  // Simulación simple: mover bus una fracción hacia el alumno cada tick
  const iniciarSimulacion = () => {
    if (intervaloRef.current) return;
    let lastTime = Date.now();
    intervaloRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000; // s
      lastTime = now;

      // paso simple: mover 30 m por segundo aproximado hacia destino
      const distanciaActual = distanciaHaversine(bus.lat, bus.lng, alumno.lat, alumno.lng);
      const paso = Math.min(20, distanciaActual); // no avanzar más que la distancia restante

      // interpolación simple hacia destino
      const factor = paso / Math.max(distanciaActual, 1);
      const nuevaLat = bus.lat + (alumno.lat - bus.lat) * factor;
      const nuevaLng = bus.lng + (alumno.lng - bus.lng) * factor;

      const nuevaDist = distanciaHaversine(nuevaLat, nuevaLng, alumno.lat, alumno.lng);
      const velocidadActual = distanciaActual === paso ? paso / dt : (distanciaActual - nuevaDist) / dt;

      setBus({ lat: nuevaLat, lng: nuevaLng });
      setVelocidad((v) => {
        // suavizamos ligeramente
        const vsm = suavizarMediaMovil([v, velocidadActual], 2) || velocidadActual;
        return Number(vsm.toFixed(2));
      });

      setHistorialDistancias((h) => {
        const nuevo = [...h, nuevaDist];
        if (nuevo.length > 10) nuevo.shift();
        // Intentar enviar ping a Firestore si está habilitado por variable de entorno
        try {
          if (import.meta.env.VITE_ENABLE_GPS_UPLOAD === 'true') {
            // vehicleId de ejemplo: 'bus-1' — en producción usar ID real del vehículo
            enviarPing('bus-1', nuevaLat, nuevaLng, velocidadActual, null, { simulated: true })
              .catch(() => {})
          }
        } catch (e) {
          // noop
        }
        return nuevo;
      });
    }, 1500);
  };

  const detenerSimulacion = () => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  };

  useEffect(() => {
    // recalcular estado cada vez que cambian las distancias
    if (!historialDistancias.length) return;
    const est = estaAcercando(historialDistancias, 0.5);
    setEstado(est);
  }, [historialDistancias]);

  const distanciaActual = historialDistancias.length ? historialDistancias[historialDistancias.length - 1] : distanciaHaversine(bus.lat, bus.lng, alumno.lat, alumno.lng);
  const etaSegundos = calcularETA(distanciaActual, velocidad) || null;

  return (
    <div style={{ maxWidth: 960, margin: '12px auto', padding: 12 }}>
      <h3>Demo de geolocalización</h3>
      <p>Este demo simula la posición del bus y calcula distancia, ETA y si se está acercando.</p>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
        <div className="panel">
          <strong>Bus (posición actual)</strong>
          <div>Lat: {bus.lat.toFixed(6)}</div>
          <div>Lng: {bus.lng.toFixed(6)}</div>
        </div>

        <div className="panel">
          <strong>Alumno (destino)</strong>
          <div>Lat: {alumno.lat.toFixed(6)}</div>
          <div>Lng: {alumno.lng.toFixed(6)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="panel">
        <MapContainer
          style={{ height: 300, width: '100%', borderRadius: 12 }}
          center={[bus.lat, bus.lng]}
          zoom={13}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker center={[bus.lat, bus.lng]} pathOptions={{ color: '#2563eb' }} radius={8} />
          <CircleMarker center={[alumno.lat, alumno.lng]} pathOptions={{ color: '#059669' }} radius={6} />
          <Polyline positions={[[bus.lat, bus.lng], [alumno.lat, alumno.lng]]} pathOptions={{ color: '#94a3b8', dashArray: '6' }} />
          <FitBounds puntos={[bus, alumno]} />
        </MapContainer>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <button className="btn" onClick={iniciarSimulacion}>Iniciar simulación</button>
        <button className="btn secondary" onClick={detenerSimulacion}>Detener</button>
        <button className="btn ghost" onClick={() => { setHistorialDistancias([]); setVelocidad(0); }}>Reset historial</button>
      </div>

      <div style={{ marginTop: 12 }} className="panel">
        <div>Distancia: <strong>{distanciaActual ? `${(distanciaActual/1000).toFixed(3)} km` : '—'}</strong></div>
        <div>Velocidad (m/s): <strong>{velocidad ?? '—'}</strong></div>
        <div>Estado: <strong>{estado}</strong></div>
        <div>ETA: <strong>{etaSegundos ? `${Math.round(etaSegundos/60)} min (${Math.round(etaSegundos)} s)` : '—'}</strong></div>
      </div>

      <div style={{ marginTop: 12 }} className="panel">
        <strong>Historial de distancias (m)</strong>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 8 }}>
          {historialDistancias.length === 0 && <div className="note">Sin datos aún</div>}
          {historialDistancias.map((d, i) => (
            <div key={i} style={{ minWidth: 80, padding: 8, background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-sm)' }}>{Math.round(d)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
