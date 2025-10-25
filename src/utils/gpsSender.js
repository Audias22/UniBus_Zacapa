import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * enviarPing(vehicleId, lat, lng, velocidad, heading, extra)
 * Guarda un ping de telemetría en Firestore bajo: vehicles/{vehicleId}/positions
 * Las aplicaciones móviles (conductor) deberán llamar a esta función.
 */
export async function enviarPing(vehicleId, lat, lng, velocidad = null, heading = null, extra = {}) {
  if (!vehicleId) throw new Error('vehicleId es requerido')
  const colRef = collection(db, 'vehicles', vehicleId, 'positions')
  const payload = {
    lat: Number(lat),
    lng: Number(lng),
    velocidad: velocidad == null ? null : Number(velocidad),
    heading: heading == null ? null : Number(heading),
    extra: extra || {},
    ts: serverTimestamp(),
  }
  const docRef = await addDoc(colRef, payload)
  return docRef.id
}

export default enviarPing
