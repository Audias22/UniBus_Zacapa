import React, { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

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

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev=>({ ...prev, [name]: value }))
  }

  const handleSubmit = async e =>{
    e.preventDefault()
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
    <section>
      <h2>Formulario público de registro de viaje</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>Nombre
          <input name="firstName" value={form.firstName} onChange={handleChange} required />
        </label>

        <label>Apellido
          <input name="lastName" value={form.lastName} onChange={handleChange} required />
        </label>

        <label>Universidad
          <select name="university" value={form.university} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            {UNIVERSITIES.map(u=> <option key={u} value={u}>{u}</option>)}
          </select>
        </label>

        <label>Número de teléfono
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="+502 4xxxxxxx" />
        </label>

        <label>Horario de vuelta
          <select name="returnTime" value={form.returnTime} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            <option value="16:00">4 PM</option>
            <option value="18:00">6 PM</option>
            <option value="indefinido">Indefinido</option>
          </select>
        </label>

        <label>Lugar de abordo
          <select name="boardingLocation" value={form.boardingLocation} onChange={handleChange} required>
            <option value="">-- selecciona --</option>
            {BOARDING.map(b=> <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        {form.boardingLocation === 'otra' && (
          <label>Otro lugar
            <input name="otherLocation" value={form.otherLocation} onChange={handleChange} placeholder="Especifica lugar" />
          </label>
        )}

        <label>Observaciones (opcional)
          <input name="notes" value={form.notes} onChange={handleChange} />
        </label>

        <button type="submit">Registrar</button>
      </form>

      {status === 'sending' && <p>Enviando...</p>}
      {status === 'ok' && <p className="success">Registro enviado. Gracias.</p>}
      {status === 'error' && <p className="error">Ocurrió un error. Intenta de nuevo.</p>}

      <p className="note">Nota: El admin podrá ver y marcar pagos en el roster.</p>
    </section>
  )
}
