// Utilidades de geolocalización - nombres en español
// Funciones pequeñas y deterministas para calcular distancia, rumbo y estado (acercando/alejando)

// Radio de la Tierra en metros
const R_Tierra = 6371000;

/**
 * distanciaHaversine(lat1, lon1, lat2, lon2) -> distancia en metros
 */
export function distanciaHaversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_Tierra * c;
}

/**
 * calcularRumbo(lat1, lon1, lat2, lon2) -> rumbo en grados (0..360)
 */
export function calcularRumbo(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  let brng = toDeg(Math.atan2(y, x));
  brng = (brng + 360) % 360;
  return brng;
}

/**
 * diferenciaAngular(rumboA, rumboB) -> diferencia en grados normalizada (-180..180)
 */
export function diferenciaAngular(rA, rB) {
  let diff = (rB - rA + 540) % 360 - 180;
  return diff;
}

/**
 * suavizarMediaMovil(array, longitud) -> media movil simple de la última 'longitud' entradas
 */
export function suavizarMediaMovil(array = [], longitud = 3) {
  if (!array.length) return null;
  const slice = array.slice(-longitud);
  const suma = slice.reduce((s, v) => s + v, 0);
  return suma / slice.length;
}

/**
 * estaAcercando(historialDistancias, umbralMeters = 1) -> 'acercando'|'alejando'|'parado'
 * Compara las últimas dos mediciones (o pendiente simple). Usa umbral para evitar ruido.
 */
export function estaAcercando(historialDistancias = [], umbralMeters = 1) {
  if (historialDistancias.length < 2) return 'desconocido';
  const n = historialDistancias.length;
  const ahora = historialDistancias[n - 1];
  const antes = historialDistancias[n - 2];
  const delta = ahora - antes; // si delta < 0 -> distancia decrece -> acercando
  if (Math.abs(delta) <= umbralMeters) return 'parado';
  return delta < 0 ? 'acercando' : 'alejando';
}

/**
 * calcularETA(distanciaMeters, velocidadMps) -> segundos o null si no es posible
 */
export function calcularETA(distanciaMeters, velocidadMps) {
  if (!velocidadMps || velocidadMps <= 0) return null;
  return distanciaMeters / velocidadMps;
}

export default {
  distanciaHaversine,
  calcularRumbo,
  diferenciaAngular,
  suavizarMediaMovil,
  estaAcercando,
  calcularETA,
};
