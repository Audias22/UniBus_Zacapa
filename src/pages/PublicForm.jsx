import React, { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { FiUserPlus, FiMapPin, FiCheckCircle } from 'react-icons/fi'

const UNIVERSITIES = [
  'Panamericana',
  'Cunori',
  'Fahuzac Humanidades',
  'Mariano Galvez',
  'Rafael Landivar',
  'Cunzac',
]

const BOARDING = [
  'San Vicente',
  'Quebrada Honda',
  'Antombran',
  'Cabañas',
  'Huite',
  'La Reforma',
  'otra',
]

// Bus and tripType are managed by admin in the roster. Public form keeps it minimal.

export default function PublicForm(){
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    university: '',
    phone: '',
    returnTime: '',
    boardingLocation: '',
    otherLocation: '',
    notes: '',
  })
  const [status, setStatus] = useState(null)
  const [invalid, setInvalid] = useState({})

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev=>({ ...prev, [name]: value }))
    // clear inline validation for this field
    setInvalid(prev=>({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async e =>{
    e.preventDefault()
    // simple client-side validation
    const required = ['firstName','lastName','university','returnTime','boardingLocation']
    const errs = {}
    required.forEach(k=>{ if(!form[k] || form[k] === '') errs[k] = 'Este campo es obligatorio' })
    if(Object.keys(errs).length){ setInvalid(errs); setStatus('error'); return }

    setStatus('sending')
    try{
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        university: form.university,
        phone: form.phone,
        returnTime: form.returnTime,
        boardingLocation: form.boardingLocation === 'otra' ? form.otherLocation : form.boardingLocation,
        otherLocation: form.boardingLocation === 'otra' ? form.otherLocation : '',
        notes: form.notes,
        paid: false,
        createdAt: serverTimestamp(),
      }
      await addDoc(collection(db, 'registrations'), payload)
      setStatus('ok')
      setForm({ firstName: '', lastName: '', university: '', phone: '', returnTime: '', boardingLocation: '', otherLocation: '', notes: '' })
    }catch(err){
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <section className="panel">
      <div className="page-hero" style={{paddingBottom:12}}>
        <h2 className="title"><FiMapPin style={{verticalAlign:'middle',marginRight:8}}/>Formulario público de registro de viaje</h2>
        <div className="subtitle">Regístrate para el servicio de bus — rápido y seguro</div>
      </div>
      <form onSubmit={handleSubmit} className="form form-grid">
        <label>Nombre
          <input className="input" name="firstName" value={form.firstName} onChange={handleChange} required />
        </label>

        <label>Apellido
          <input className="input" name="lastName" value={form.lastName} onChange={handleChange} required />
        </label>

        <label>Universidad
          <select className={`input ${invalid.university ? 'invalid shake' : ''}`} name="university" value={form.university} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            {UNIVERSITIES.map(u=> <option key={u} value={u}>{u}</option>)}
          </select>
          {invalid.university && <div className="field-error">{invalid.university}</div>}
        </label>

        <label>Número de teléfono
          <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="+502 4xxxxxxx" />
        </label>

        <label>Horario de vuelta
          <select className={`input ${invalid.returnTime ? 'invalid shake' : ''}`} name="returnTime" value={form.returnTime} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            <option value="16:00">4 PM</option>
            <option value="18:00">6 PM</option>
            <option value="indefinido">Indefinido</option>
          </select>
          {invalid.returnTime && <div className="field-error">{invalid.returnTime}</div>}
        </label>

        <label>Lugar de abordo
          <select className={`input ${invalid.boardingLocation ? 'invalid shake' : ''}`} name="boardingLocation" value={form.boardingLocation} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            {BOARDING.map(b=> <option key={b} value={b}>{b}</option>)}
          </select>
          {invalid.boardingLocation && <div className="field-error">{invalid.boardingLocation}</div>}
        </label>

        {form.boardingLocation === 'otra' && (
          <label>Otro lugar
            <input className="input" name="otherLocation" value={form.otherLocation} onChange={handleChange} placeholder="Especifica lugar" />
          </label>
        )}

        <label style={{gridColumn:'1 / -1'}}>Observaciones (opcional)
          <input className="input" name="notes" value={form.notes} onChange={handleChange} />
        </label>

        <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button type="submit" className="btn"><span style={{display:'inline-flex',alignItems:'center',gap:8}}><FiUserPlus/>Registrar</span></button>
        </div>
      </form>

      {status === 'sending' && <p>Enviando...</p>}
      {status === 'ok' && <p className="success">Registro enviado. Gracias.</p>}
      {status === 'error' && <p className="error">Ocurrió un error. Intenta de nuevo.</p>}
    </section>
  )
}
