import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { getAuth } from 'firebase/auth'

/**
 * enviarPing(vehicleId, lat, lng, velocidad, heading, extra)
 * Guarda un ping de telemetría en Firestore bajo: vehicles/{vehicleId}/positions
 * Las aplicaciones móviles (conductor) deberán llamar a esta función.
 */
export async function enviarPing(vehicleId, lat, lng, velocidad = null, heading = null, extra = {}) {
  // Si no se pasa vehicleId, intentamos usar el uid del usuario autenticado
  let vid = vehicleId
  try {
    const a = getAuth();
    if (!vid && a && a.currentUser) vid = a.currentUser.uid
  } catch (e) {
    // ignore
  }
  if (!vid) throw new Error('vehicleId es requerido (o el usuario debe estar autenticado)')
  const colRef = collection(db, 'vehicles', vid, 'positions')
  const payload = {
    lat: Number(lat),
    lng: Number(lng),
    velocidad: velocidad == null ? null : Number(velocidad),
    heading: heading == null ? null : Number(heading),
    extra: extra || {},
    ts: serverTimestamp(),
  }
  try {
    const docRef = await addDoc(colRef, payload)
    return docRef.id
  } catch (err) {
    // Normalize Firestore permission errors to provide clearer instruction
    if (err && err.code && err.code === 'permission-denied') {
      throw new Error('Missing or insufficient permissions. Revisa las reglas de Firestore (archivo firebase.rules en el repo) y despliega las reglas para permitir que el usuario autenticado escriba en vehicles/{uid}/positions.');
    }
    throw err
  }
}

export default enviarPing
