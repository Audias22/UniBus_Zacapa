import React, { useEffect, useState } from 'react'
import { auth, db } from '../firebase'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore'
import * as XLSX from 'xlsx'

function nextSaturdayId(){
  const d = new Date()
  const day = d.getDay()
  const daysUntilSat = (6 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

export default function AdminAttendance(){
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [attendance, setAttendance] = useState({})
  const [attendanceRows, setAttendanceRows] = useState([])
  const [displayRows, setDisplayRows] = useState([])
  const [weekId, setWeekId] = useState(nextSaturdayId())
  const [weekNote, setWeekNote] = useState('')

  const handleWeekChange = (e)=>{
    const v = e.target.value // yyyy-mm-dd
    if(!v) return setWeekId('')
    const d = new Date(v+'T00:00:00')
    const day = d.getDay()
    // 6 == Saturday
    if(day === 6){
      setWeekId(v)
      setWeekNote('')
      return
    }
    // find next saturday from selected date
    const daysUntilSat = (6 - day + 7) % 7
    const next = new Date(d)
    next.setDate(d.getDate() + (daysUntilSat || 7))
    const yyyy = next.getFullYear()
    const mm = String(next.getMonth()+1).padStart(2,'0')
    const dd = String(next.getDate()).padStart(2,'0')
    const nextStr = `${yyyy}-${mm}-${dd}`
    setWeekId(nextStr)
    setWeekNote(`Ajustado al sábado: ${nextStr}`)
  }

  useEffect(()=>{
    const unsub = auth.onAuthStateChanged(u=> setUser(u))
    return unsub
  },[])

  useEffect(()=>{
    if(!user) return
    setLoading(true)
    const q = query(collection(db,'registrations'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>{
      const data = snap.docs.map(d=>({ id:d.id, ...d.data() }))
      setRows(data)
      setLoading(false)
      setError(null)
    }, err=>{
      console.error(err)
      setError(err.message||'Error al cargar registros')
      setLoading(false)
    })
    return unsub
  },[user])

  // when attendanceRows change we want to initialize attendance state
  useEffect(()=>{
    if(attendanceRows && attendanceRows.length){
      // populate attendance map from attendanceRows
      const map = {}
      attendanceRows.forEach(r=>{
        // r.registrationId may be present (if saved from registrations)
        const id = r.registrationId || r.id
        map[id] = { present: true, tripType: r.tripType || 'ida', paid: !!r.paid }
      })
      setAttendance(map)
      setDisplayRows(attendanceRows)
    } else {
      // no saved attendance for this week — clear display (user can load registrations manually)
      setAttendance({})
      setDisplayRows([])
    }
  }, [attendanceRows])

  // load attendance records for the selected week
  useEffect(()=>{
    if(!user) return
    if(!weekId) return
    const colRef = collection(db, 'attendance', weekId, 'records')
    const q = query(colRef)
    const unsub = onSnapshot(q, snap=>{
      const data = snap.docs.map(d=>({ id:d.id, ...d.data() }))
      setAttendanceRows(data)
    }, err=>{
      console.error('Error loading attendance for week', weekId, err)
      // if error, clear
      setAttendanceRows([])
    })
    return unsub
  }, [user, weekId])

  const handleLogin = async e =>{
    e.preventDefault()
    try{ await signInWithEmailAndPassword(auth, email, password) }
    catch(err){ alert('Error al iniciar sesión: '+err.message) }
  }

  const handleLogout = async ()=> await signOut(auth)

  const togglePresent = (id)=>{
    setAttendance(a=>({ ...a, [id]: { ...(a[id]||{}), present: !((a[id]||{}).present) } }))
  }

  const setTripType = (id, type)=>{
    setAttendance(a=>({ ...a, [id]: { ...(a[id]||{}), tripType: type } }))
  }

  const setPaid = (id, val)=>{
    setAttendance(a=>({ ...a, [id]: { ...(a[id]||{}), paid: val } }))
  }

  function fareFor(type){
    return type === 'ida_vuelta' ? 40 : 20
  }

  const saveAttendance = async ()=>{
    // Open confirmation modal with summary
    if(!user){ alert('Debes iniciar sesión como admin'); return }
    setConfirmOpen(true)
  }

  const performSave = async ()=>{
    // do batch write
    setConfirmOpen(false)
    const batch = writeBatch(db)
    const colRef = collection(db, 'attendance', weekId, 'records')
    let count = 0
    try{
      for(const r of rows){
        const a = attendance[r.id]
        if(a && a.present){
          const trip = a.tripType || r.tripType || 'ida'
          const recRef = doc(colRef)
          batch.set(recRef, {
            registrationId: r.id,
            firstName: r.firstName,
            lastName: r.lastName,
            university: r.university || '',
            boardingLocation: r.boardingLocation || r.otherLocation || '',
            tripType: trip,
            paid: !!a.paid,
            amount: fareFor(trip),
            collectorUid: user.uid,
            timestamp: serverTimestamp(),
            notes: r.notes || ''
          })
          count++
        }
      }
      if(count>0){
        await batch.commit()
      }
      alert(`Guardado: ${count} registros en attendance/${weekId}/records`)
    }catch(err){
      console.error(err)
      alert('Error al guardar en batch: '+err.message)
    }
  }

  const exportCSV = ()=>{
    // Column definitions: field -> header label
    // Columns adjusted per user request: remove RegistroID, Nombre, Apellido, Recaudador, Observaciones
    // Add a first column 'N°' with sequential numbering
    const cols = [
      { k: 'index', label: 'N°' },
      { k: 'fullName', label: 'Nombre completo' },
      { k: 'university', label: 'Universidad' },
      { k: 'boardingLocation', label: 'Lugar de subida' },
      { k: 'tripType', label: 'Tipo de viaje' },
      { k: 'paid', label: 'Pagado' },
      { k: 'amount', label: 'Monto (Q)' }
    ]

    const rowsOut = []
    for(const r of rows){
      const a = attendance[r.id]
      if(a && a.present){
        const trip = a.tripType || r.tripType || 'ida'
        rowsOut.push({
          index: rowsOut.length + 1,
          fullName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
          university: r.university||'',
          boardingLocation: r.boardingLocation||r.otherLocation||'',
          tripType: trip === 'ida' ? 'Solo ida' : (trip === 'ida_vuelta' ? 'Ida y vuelta' : 'Solo vuelta'),
          paid: a.paid ? 'Sí' : 'No',
          amount: Number(fareFor(trip)).toFixed(2),
          timestamp: new Date().toISOString()
        })
      }
    }
    if(!rowsOut.length){ alert('No hay registros seleccionados para exportar'); return }

    // Use semicolon as delimiter which is commonly expected by Excel in many locales (Spanish)
    const delim = ';'

    // helper to safely quote and escape fields
    const quote = val => '"' + String(val === undefined || val === null ? '' : val).replace(/"/g,'""') + '"'

    // header labels
    const headerLine = cols.map(c=> quote(c.label) ).join(delim)

    const lines = rowsOut.map(row => cols.map(c => quote(row[c.k])).join(delim))

    // Calculate totals for cierre de caja
    const totalCount = rowsOut.length
    const totalAmount = rowsOut.reduce((s,r)=> s + (parseFloat(r.amount)||0), 0)

    // Title line (fecha en formato guatemalteco dd/mm/yyyy) + recaudador
    const formatDateGUAT = (isoYmd)=>{
      if(!isoYmd) return ''
      const parts = isoYmd.split('-') // yyyy-mm-dd
      if(parts.length!==3) return isoYmd
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    const title = `Reporte de asistencia — Semana: ${formatDateGUAT(weekId)}${user?.email ? ' — Recaudador: ' + user.email : ''}`

    // Build CSV: title line alone, blank line, header, data lines, blank line, totals line
    const titleLine = quote(title)
    const blankLine = ''
    const csvBody = [titleLine, blankLine, headerLine].concat(lines).concat([blankLine]).concat([
      // totals row: put totalCount in N°, label 'TOTAL' in Nombre completo, amount in Monto
      cols.map(c => {
        if(c.k === 'index') return quote(totalCount)
        if(c.k === 'fullName') return quote('TOTAL')
        if(c.k === 'amount') return quote(totalAmount.toFixed(2))
        return quote('')
      }).join(delim)
    ]).join('\n')

    // Prepend UTF-8 BOM so Excel on Windows recognizes UTF-8 (evita 'signos raros')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${weekId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportXLSX = ()=>{
    // Load preformatted template and insert data into it
    const tplPath = '/templates/attendance_template.xlsx'
    fetch(tplPath).then(r => r.arrayBuffer()).then(buf => {
      const wb = XLSX.read(buf, {type:'array', cellStyles:true})
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]

      // compute title and set it in A1
  const title = `Reporte de asistencia — Semana: ${(() => { const p=weekId.split('-'); return p.length===3? `${p[2]}/${p[1]}/${p[0]}`: weekId })()}`
      if(!ws['A1']) ws['A1'] = { t:'s', v: title }
      else ws['A1'].v = title

      // find header row (search for N° header)
      const data = XLSX.utils.sheet_to_json(ws, {header:1, raw:false})
      let headerRowIndex = -1
      for(let i=0;i<data.length;i++){
        const row = data[i]
        if(row && row.some(cell => String(cell).toLowerCase().includes('nombre'))){ headerRowIndex = i; break }
      }
      if(headerRowIndex === -1) headerRowIndex = 2

      // remove any rows after headerRowIndex (we'll append data)
      const startDataRow = headerRowIndex + 1
      // convert existing sheet to aoa, slice up to headerRowIndex inclusive
      const aoa = data.slice(0, startDataRow)

      const rowsOut = []
      for(const r of rows){
        const a = attendance[r.id]
        if(a && a.present){
          const trip = a.tripType || r.tripType || 'ida'
          rowsOut.push([rowsOut.length+1, `${r.firstName||''} ${r.lastName||''}`.trim(), r.university||'', r.boardingLocation||r.otherLocation||'', trip === 'ida' ? 'Solo ida' : (trip === 'ida_vuelta' ? 'Ida y vuelta' : 'Solo vuelta'), a.paid ? 'Sí' : 'No', Number(fareFor(trip))])
        }
      }

      // append data rows
      for(const rr of rowsOut) aoa.push(rr)
      // append blank then totals
      aoa.push([])
      const totalAmount = rowsOut.reduce((s,r)=> s + (Number(r[6])||0), 0)
      aoa.push([rowsOut.length, 'TOTAL', '', '', '', '', totalAmount])

  const newWs = XLSX.utils.aoa_to_sheet(aoa)
  // Force title into A1 to ensure template placeholder is replaced
  if(!newWs['A1']) newWs['A1'] = { t: 's', v: title }
  else newWs['A1'].v = title
      // preserve merges from template
      if(ws['!merges']) newWs['!merges'] = ws['!merges']
      if(ws['!cols']) newWs['!cols'] = ws['!cols']

      wb.Sheets[sheetName] = newWs
      const out = XLSX.write(wb, {bookType:'xlsx', type:'array', cellStyles:true})
      const blob = new Blob([out], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-${weekId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(err=>{
      console.error('Error loading template', err)
      alert('No se pudo cargar la plantilla. Intenta exportar XLSX normal.')
    })
  }

  // Fallback / alternative: export as HTML table with inline styles and .xls extension
  // This ensures visual styles (colors, borders, currency) are preserved when opened in Excel.
  const exportStyledExcel = ()=>{
    const rowsOut = []
    for(const r of rows){
      const a = attendance[r.id]
      if(a && a.present){
        const trip = a.tripType || r.tripType || 'ida'
        rowsOut.push({
          fullName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
          university: r.university||'',
          boardingLocation: r.boardingLocation||r.otherLocation||'',
          tripType: trip === 'ida' ? 'Solo ida' : (trip === 'ida_vuelta' ? 'Ida y vuelta' : 'Solo vuelta'),
          paid: a.paid ? 'Sí' : 'No',
          amount: Number(fareFor(trip))
        })
      }
    }
    if(!rowsOut.length){ alert('No hay registros seleccionados para exportar'); return }

    const title = `Reporte de asistencia — Semana: ${(() => { const p=weekId.split('-'); return p.length===3? `${p[2]}/${p[1]}/${p[0]}`: weekId })()}${user?.email ? ' — Recaudador: ' + user.email : ''}`

    // Build HTML table with inline styles
    const style = `
      table{border-collapse:collapse;font-family:Arial,Helvetica,sans-serif}
      th,td{border:1px solid #bbb;padding:6px;text-align:left}
      th{background:#D9E1F2;font-weight:700}
      .title{font-size:14px;font-weight:700;padding:8px}
      .right{text-align:right}
    `

    let html = `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>`
    html += `<div class="title">${title}</div>`
    html += '<table>'
    html += '<thead><tr>'
    const headers = ['N°','Nombre completo','Universidad','Lugar de subida','Tipo de viaje','Pagado','Monto (Q)']
    headers.forEach(h=> html += `<th>${h}</th>`)
    html += '</tr></thead><tbody>'
    rowsOut.forEach((r,i)=>{
      html += '<tr>'
      html += `<td>${i+1}</td>`
      html += `<td>${escapeHtml(r.fullName)}</td>`
      html += `<td>${escapeHtml(r.university)}</td>`
      html += `<td>${escapeHtml(r.boardingLocation)}</td>`
      html += `<td>${escapeHtml(r.tripType)}</td>`
      html += `<td>${escapeHtml(r.paid)}</td>`
      html += `<td class="right">Q${(Number(r.amount)||0).toFixed(2)}</td>`
      html += '</tr>'
    })
    // totals row
    const totalAmount = rowsOut.reduce((s,r)=> s + (Number(r.amount)||0), 0)
    html += `<tr><td>${rowsOut.length}</td><td style="font-weight:700">TOTAL</td><td></td><td></td><td></td><td></td><td class="right" style="font-weight:700">Q${totalAmount.toFixed(2)}</td></tr>`
    html += '</tbody></table></body></html>'

    // helper to escape HTML
    function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

    const bom = '\uFEFF'
    const blob = new Blob([bom + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${weekId}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  if(!user){
    return (
      <section className="panel">
        <div className="header">
          <div>
            <h2 className="title">Admin — Pasar lista (Iniciar sesión)</h2>
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
      </section>
    )
  }

  return (
    <section className="panel attendance">
      <div className="header" style={{justifyContent:'space-between'}}>
        <div>
          <h2 className="title">Pasar lista — Semana: {weekId}</h2>
          <div className="subtitle">Usuario: {user.email}</div>
        </div>
        <div>
          <button className="btn secondary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
        <div className="controls">
        <label style={{display:'inline-flex',alignItems:'center',gap:8}}>Seleccionar sábado: <input className="input" type="date" value={weekId} onChange={handleWeekChange} /></label>
        <button className="btn" onClick={saveAttendance}>Guardar asistencia</button>
        <button className="btn secondary" onClick={exportXLSX} style={{marginLeft:8}}>Exportar XLSX</button>
      </div>
      {weekNote && <p className="note" style={{marginTop:4}}>{weekNote}</p>}

      {loading && <p>Cargando registros...</p>}

      <div className="table-wrap">
        {displayRows.length === 0 ? (
          <div style={{padding:16}}>
            <p className="note">No hay registros de asistencia guardados para la semana seleccionada ({weekId}).</p>
            <p className="note">Si quieres marcar la asistencia para esta semana, carga las inscripciones:</p>
            <button className="btn" onClick={()=> setDisplayRows(rows)}>Cargar inscripciones</button>
          </div>
        ) : (
        <table className="roster">
          <thead>
            <tr>
              <th>Presente</th>
              <th>Nombre</th>
              <th>Universidad</th>
              <th>Lugar</th>
              <th>Tipo</th>
              <th>Pagado</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(r=> {
              // r may be either a registration or an attendance record
              const regId = r.registrationId || r.id
              const first = r.firstName || r.firstName || ''
              const last = r.lastName || r.lastName || ''
              const uni = r.university || ''
              const place = r.boardingLocation || r.otherLocation || r.boardingLocation || ''
              const tripFromRow = r.tripType || r.tripType || 'ida'
              const t = attendance[regId]?.tripType || tripFromRow
              return (
              <tr key={regId}>
                <td><input type="checkbox" checked={!!(attendance[regId]?.present)} onChange={()=>togglePresent(regId)} /></td>
                <td>{r.firstName || r.name || (r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : '')}</td>
                <td>{uni}</td>
                <td>{place}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <select value={t} onChange={e=>setTripType(regId, e.target.value)}>
                      <option value="ida">Solo ida</option>
                      <option value="ida_vuelta">Ida y vuelta</option>
                      <option value="vuelta">Solo vuelta</option>
                    </select>
                    <span className="fare-inline">Q{fareFor(t)}.00</span>
                  </div>
                </td>
                <td>
                  <button
                    className={"attendance-paid-btn " + (attendance[regId]?.paid ? 'paid' : 'not-paid')}
                    onClick={()=>setPaid(regId, !((attendance[regId]||{}).paid))}
                    title={attendance[regId]?.paid ? 'Marcar como no pagado' : 'Marcar como pagado'}
                    aria-pressed={!!(attendance[regId]?.paid)}
                  >
                    {attendance[regId]?.paid ? 'Sí' : 'No'}
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        )}
      </div>
      {confirmOpen && (
        <div className="modal-overlay" onClick={()=>setConfirmOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
            <h3>Confirmar guardado</h3>
            <p>Registros seleccionados: <strong>{Object.values(attendance).filter(a=>a.present).length}</strong></p>
            <p>Total estimado: <strong>Q{Object.entries(attendance).reduce((sum,[id,a])=>{
              if(!a || !a.present) return sum
              const trip = a.tripType || (rows.find(r=>r.id===id)?.tripType) || 'ida'
              return sum + fareFor(trip)
            },0)}.00</strong></p>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={performSave}>Confirmar y guardar</button>
              <button onClick={()=>setConfirmOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
