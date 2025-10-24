#!/usr/bin/env node
/**
 * Script: clean_attendance_duplicates.js
 * Purpose: Recorrer attendance/*/records y eliminar documentos duplicados
 *           (mismo registrationId) por semana. Por seguridad hace dry-run
 *           por defecto. Use --apply para ejecutar las eliminaciones.
 *
 * Usage:
 *   node scripts/clean_attendance_duplicates.js --mode mostRecent|mostComplete [--apply]
 *
 * Authentication:
 *   Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json or
 *   export SERVICE_ACCOUNT_PATH=/path/to/serviceAccountKey.json
 */

const admin = require('firebase-admin')
const path = require('path')

async function initAdmin(){
  const svcPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if(svcPath){
    const abs = path.isAbsolute(svcPath) ? svcPath : path.join(process.cwd(), svcPath)
    console.log('Inicializando Firebase Admin con credenciales:', abs)
    const serviceAccount = require(abs)
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  } else {
    console.log('Inicializando Firebase Admin con credenciales por defecto (ADC)')
    admin.initializeApp()
  }
}

function usageAndExit(){
  console.log('\nUso: node scripts/clean_attendance_duplicates.js --mode mostRecent|mostComplete [--apply]\n')
  process.exit(1)
}

function scoreDocForCompleteness(data){
  // heuristic: prefer docs marked paid, with notes, amount, and populated names
  let score = 0
  if(data.paid) score += 50
  if(data.notes) score += 5
  if(data.amount) score += 3
  if(data.firstName) score += 2
  if(data.lastName) score += 2
  if(data.university) score += 1
  if(data.timestamp) score += 1
  return score
}

async function run(){
  const args = process.argv.slice(2)
  if(args.length === 0) return usageAndExit()
  const modeArgIndex = args.indexOf('--mode')
  let mode = null
  if(modeArgIndex !== -1 && args[modeArgIndex+1]) mode = args[modeArgIndex+1]
  else {
    // allow --mode=value
    const m = args.find(a => a.startsWith('--mode='))
    if(m) mode = m.split('=')[1]
  }
  if(!mode || (mode !== 'mostRecent' && mode !== 'mostComplete')) return usageAndExit()

  const apply = args.includes('--apply')

  await initAdmin()
  const db = admin.firestore()

  console.log(`Modo: ${mode} | Aplicar cambios: ${apply ? 'SI' : 'NO (dry-run)'}`)

  const attendanceCol = db.collection('attendance')
  const weekDocs = await attendanceCol.listDocuments()
  console.log(`Se encontraron ${weekDocs.length} semanas en 'attendance'.`)

  let totalGroups = 0
  let totalDuplicates = 0
  let totalDeleted = 0

  for(const weekRef of weekDocs){
    const weekId = weekRef.id
    const recordsRef = weekRef.collection('records')
    const snap = await recordsRef.get()
    if(snap.empty) continue
    console.log(`\nProcesando semana: ${weekId} — ${snap.size} registros`)

    const byReg = new Map()
    snap.docs.forEach(doc => {
      const data = doc.data()
      const regId = data.registrationId || doc.id
      if(!byReg.has(regId)) byReg.set(regId, [])
      byReg.get(regId).push({ id: doc.id, ref: doc.ref, data })
    })

    let weekGroups = 0
    let weekDupCount = 0
    let weekDeleted = 0

    // collect delete operations in batches of <= 400 (reserve safe margin)
    let deleteBatch = db.batch()
    let batchOps = 0

    for(const [regId, docs] of byReg.entries()){
      if(docs.length <= 1) continue
      weekGroups++
      totalGroups++
      weekDupCount += docs.length - 1
      totalDuplicates += docs.length - 1

      // choose keeper
      let keeper = docs[0]
      if(mode === 'mostComplete'){
        let best = keeper
        let bestScore = scoreDocForCompleteness(keeper.data)
        for(const d of docs){
          const s = scoreDocForCompleteness(d.data)
          if(s > bestScore){ best = d; bestScore = s }
          else if(s === bestScore){
            // tie-breaker: prefer newer timestamp
            const curTs = d.data.timestamp && d.data.timestamp.toMillis ? d.data.timestamp.toMillis() : 0
            const bestTs = best.data.timestamp && best.data.timestamp.toMillis ? best.data.timestamp.toMillis() : 0
            if(curTs > bestTs) best = d
          }
        }
        keeper = best
      } else { // mostRecent
        let recent = keeper
        let recentTs = keeper.data.timestamp && keeper.data.timestamp.toMillis ? keeper.data.timestamp.toMillis() : 0
        for(const d of docs){
          const t = d.data.timestamp && d.data.timestamp.toMillis ? d.data.timestamp.toMillis() : 0
          if(t > recentTs){ recent = d; recentTs = t }
        }
        keeper = recent
      }

      // Determine which to delete
      const toDelete = docs.filter(d => d.id !== keeper.id)

      console.log(` registrationId=${regId}: found ${docs.length} docs, keeping '${keeper.id}', deleting ${toDelete.length}`)

      if(apply){
        for(const d of toDelete){
          deleteBatch.delete(d.ref)
          batchOps++
          weekDeleted++
          totalDeleted++
          if(batchOps >= 400){
            await deleteBatch.commit()
            deleteBatch = db.batch()
            batchOps = 0
            console.log('Committed a batch of 400 deletes...')
          }
        }
      }
    }

    if(apply && batchOps > 0){
      await deleteBatch.commit()
      console.log(`Committed final delete batch for week ${weekId}`)
    }

    if(weekGroups > 0){
      console.log(`Semana ${weekId}: ${weekGroups} grupos con duplicados, duplicados totales: ${weekDupCount}, eliminados: ${weekDeleted}`)
    } else {
      console.log(`Semana ${weekId}: sin duplicados`) 
    }
  }

  console.log('\nResumen:')
  console.log(` Grupos con duplicados encontrados: ${totalGroups}`)
  console.log(` Documentos considerados duplicados: ${totalDuplicates}`)
  console.log(` Documentos eliminados: ${totalDeleted}`)
  if(!apply) console.log('\nNota: Se ejecutó en modo dry-run. Re-run con --apply para efectuar borrados.')
}

run().catch(err=>{
  console.error('Error en ejecución:', err)
  process.exit(2)
})
