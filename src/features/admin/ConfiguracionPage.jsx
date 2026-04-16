import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Save, Plus, Pencil, X, Check, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

const SALON_NAME = 'Billar Tito'

// ─── Hook ────────────────────────────────────────────────────────────────────

function useConfigData() {
  const [salonId,  setSalonId]  = useState(null)
  const [salon,    setSalon]    = useState({ nombre: '', direccion: '', nit: '' })
  const [tarifas,  setTarifas]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: salones, error: salonErr } = await supabase
          .from('salones')
          .select('id, nombre, direccion, nit')
          .eq('nombre', SALON_NAME)
          .limit(1)

        if (salonErr) throw salonErr
        if (!salones?.length) throw new Error(`Salón "${SALON_NAME}" no encontrado.`)

        const s = salones[0]

        const { data: tarifasData, error: tarifasErr } = await supabase
          .from('tarifas')
          .select('id, nombre, precio_hora, activo')
          .eq('salon_id', s.id)
          .order('nombre')

        if (tarifasErr) throw tarifasErr

        if (!cancelled) {
          setSalonId(s.id)
          setSalon({ nombre: s.nombre ?? '', direccion: s.direccion ?? '', nit: s.nit ?? '' })
          setTarifas(tarifasData ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Error cargando configuración')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function updateSalon(fields) {
    const { error } = await supabase
      .from('salones')
      .update({ nombre: fields.nombre, direccion: fields.direccion, nit: fields.nit })
      .eq('id', salonId)
    if (error) return error.message
    setSalon(fields)
  }

  async function addTarifa(nombre, precio_hora) {
    const { data, error } = await supabase
      .from('tarifas')
      .insert({ salon_id: salonId, nombre, precio_hora: Number(precio_hora) })
      .select('id, nombre, precio_hora, activo')
      .single()
    if (error) return error.message
    setTarifas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  }

  async function updateTarifa(id, nombre, precio_hora) {
    const { error } = await supabase
      .from('tarifas')
      .update({ nombre, precio_hora: Number(precio_hora) })
      .eq('id', id)
    if (error) return error.message
    setTarifas(prev =>
      prev.map(t => t.id === id ? { ...t, nombre, precio_hora: Number(precio_hora) } : t)
    )
  }

  async function toggleTarifa(id, activo) {
    const { error } = await supabase
      .from('tarifas')
      .update({ activo: !activo })
      .eq('id', id)
    if (error) return error.message
    setTarifas(prev => prev.map(t => t.id === id ? { ...t, activo: !activo } : t))
  }

  return { salonId, salon, tarifas, loading, error, updateSalon, addTarifa, updateTarifa, toggleTarifa }
}

// ─── Sección 1: Datos del salón ───────────────────────────────────────────────

function SalonForm({ salon, onSave }) {
  const [draft,   setDraft]   = useState(salon)
  const [saving,  setSaving]  = useState(false)
  const [feedback, setFeedback] = useState(null) // { ok: bool, msg: string }

  // Sync if parent salon changes (initial load)
  useEffect(() => { setDraft(salon) }, [salon.nombre, salon.direccion, salon.nit])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    const err = await onSave(draft)
    setSaving(false)
    setFeedback(err ? { ok: false, msg: err } : { ok: true, msg: 'Guardado correctamente' })
    if (!err) setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <Field label="Nombre del salón" value={draft.nombre}
        onChange={v => setDraft(d => ({ ...d, nombre: v }))} />
      <Field label="Dirección" value={draft.direccion}
        onChange={v => setDraft(d => ({ ...d, direccion: v }))} />
      <Field label="NIT" value={draft.nit}
        onChange={v => setDraft(d => ({ ...d, nit: v }))} />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar
        </button>
        {feedback && (
          <span className={`text-xs ${feedback.ok ? 'text-green-400' : 'text-red-400'}`}>
            {feedback.msg}
          </span>
        )}
      </div>
    </form>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
          focus:outline-none focus:border-indigo-500 transition-colors"
      />
    </div>
  )
}

// ─── Sección 2: Tarifas ───────────────────────────────────────────────────────

function TarifasPanel({ tarifas, onAdd, onUpdate, onToggle }) {
  const [editingId,  setEditingId]  = useState(null)
  const [editDraft,  setEditDraft]  = useState({ nombre: '', precio_hora: '' })
  const [addDraft,   setAddDraft]   = useState({ nombre: '', precio_hora: '' })
  const [saving,     setSaving]     = useState(false)
  const [rowError,   setRowError]   = useState({}) // id → msg

  async function handleSaveEdit(t) {
    if (!editDraft.nombre.trim() || editDraft.precio_hora === '') return
    setSaving(true)
    const err = await onUpdate(t.id, editDraft.nombre.trim(), editDraft.precio_hora)
    setSaving(false)
    if (err) { setRowError(prev => ({ ...prev, [t.id]: err })); return }
    setEditingId(null)
    setRowError(prev => { const n = { ...prev }; delete n[t.id]; return n })
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditDraft({ nombre: t.nombre, precio_hora: String(t.precio_hora) })
    setRowError(prev => { const n = { ...prev }; delete n[t.id]; return n })
  }

  async function handleToggle(t) {
    const err = await onToggle(t.id, t.activo)
    if (err) setRowError(prev => ({ ...prev, [t.id]: err }))
  }

  async function handleAdd() {
    if (!addDraft.nombre.trim() || addDraft.precio_hora === '') return
    setSaving(true)
    const err = await onAdd(addDraft.nombre.trim(), addDraft.precio_hora)
    setSaving(false)
    if (err) { setRowError(prev => ({ ...prev, __add: err })); return }
    setAddDraft({ nombre: '', precio_hora: '' })
    setRowError(prev => { const n = { ...prev }; delete n.__add; return n })
  }

  return (
    <div className="max-w-lg">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_80px_80px] gap-2 px-4 py-2 border-b border-gray-800">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nombre</span>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide text-right">Precio / hora</span>
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide text-center">Estado</span>
          <span />
        </div>

        {/* Rows */}
        {tarifas.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-6">Sin tarifas. Agrega una abajo.</p>
        )}

        {tarifas.map(t => (
          <div key={t.id} className="border-b border-gray-800/60 last:border-0">
            {editingId === t.id ? (
              /* Edit mode */
              <div className="flex items-center gap-2 px-4 py-2">
                <input
                  autoFocus
                  value={editDraft.nombre}
                  onChange={e => setEditDraft(d => ({ ...d, nombre: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
                    focus:outline-none focus:border-indigo-500"
                  placeholder="Nombre"
                />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={editDraft.precio_hora}
                  onChange={e => setEditDraft(d => ({ ...d, precio_hora: e.target.value }))}
                  className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white text-right
                    focus:outline-none focus:border-indigo-500"
                  placeholder="0"
                />
                <button
                  onClick={() => handleSaveEdit(t)}
                  disabled={saving}
                  className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
                {rowError[t.id] && (
                  <span className="text-xs text-red-400 ml-1">{rowError[t.id]}</span>
                )}
              </div>
            ) : (
              /* View mode */
              <div className="grid grid-cols-[1fr_120px_80px_80px] items-center gap-2 px-4 py-2.5">
                <span className="text-sm text-white truncate">{t.nombre}</span>
                <span className="text-sm text-indigo-400 font-mono text-right">
                  ${Number(t.precio_hora).toLocaleString('es-CO')}/h
                </span>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleToggle(t)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                      ${t.activo
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                  >
                    {t.activo
                      ? <><ToggleRight size={12} /> Activa</>
                      : <><ToggleLeft  size={12} /> Inactiva</>}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add row */}
        <div className="border-t border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              value={addDraft.nombre}
              onChange={e => setAddDraft(d => ({ ...d, nombre: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white
                focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Nombre de tarifa"
            />
            <input
              type="number"
              min="0"
              step="100"
              value={addDraft.precio_hora}
              onChange={e => setAddDraft(d => ({ ...d, precio_hora: e.target.value }))}
              className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white text-right
                focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="$/hora"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !addDraft.nombre.trim() || addDraft.precio_hora === ''}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm
                hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Agregar
            </button>
          </div>
          {rowError.__add && (
            <p className="text-xs text-red-400 mt-1">{rowError.__add}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { salon, tarifas, loading, error, updateSalon, addTarifa, updateTarifa, toggleTarifa } = useConfigData()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando configuración...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-10">

      {/* Sección 1 */}
      <section>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
          Datos del salón
        </h2>
        <SalonForm salon={salon} onSave={updateSalon} />
      </section>

      <div className="border-t border-gray-800" />

      {/* Sección 2 */}
      <section>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
          Tarifas
        </h2>
        <TarifasPanel
          tarifas={tarifas}
          onAdd={addTarifa}
          onUpdate={updateTarifa}
          onToggle={toggleTarifa}
        />
      </section>

    </div>
  )
}
