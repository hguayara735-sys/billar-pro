import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, Pencil, X, Check, ToggleLeft, ToggleRight, Building2Plus } from 'lucide-react'

// ─── Hook ────────────────────────────────────────────────────────────────────

function useSalonesData() {
  const [salones,  setSalones]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('salones')
        .select('id, nombre, direccion, telefono, activo')
        .order('nombre')
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setSalones(data ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function addSalon(nombre, direccion, telefono) {
    try {
      const { data, error } = await supabase
        .from('salones')
        .insert({ nombre: nombre.trim(), direccion: direccion.trim(), telefono: telefono.trim() })
        .select('id, nombre, direccion, telefono, activo')
        .single()
      if (error) return error.message
      setSalones(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    } catch (err) {
      return err?.message ?? 'Error inesperado'
    }
  }

  async function updateSalon(id, nombre, direccion, telefono) {
    const { error } = await supabase
      .from('salones')
      .update({ nombre: nombre.trim(), direccion: direccion.trim(), telefono: telefono.trim() })
      .eq('id', id)
    if (error) return error.message
    setSalones(prev =>
      prev
        .map(s => s.id === id ? { ...s, nombre: nombre.trim(), direccion: direccion.trim(), telefono: telefono.trim() } : s)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
  }

  async function toggleSalon(id, activo) {
    const { error } = await supabase
      .from('salones')
      .update({ activo: !activo })
      .eq('id', id)
    if (error) return error.message
    setSalones(prev => prev.map(s => s.id === id ? { ...s, activo: !activo } : s))
  }

  return { salones, loading, error, addSalon, updateSalon, toggleSalon }
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

function SalonesTable({ salones, onUpdate, onToggle }) {
  const [editingId, setEditingId] = useState(null)
  const [draft,     setDraft]     = useState({ nombre: '', direccion: '', telefono: '' })
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState({})

  function startEdit(s) {
    setEditingId(s.id)
    setDraft({ nombre: s.nombre, direccion: s.direccion ?? '', telefono: s.telefono ?? '' })
    setErrors(prev => { const n = { ...prev }; delete n[s.id]; return n })
  }

  async function handleSave(id) {
    if (!draft.nombre.trim()) return
    setSaving(true)
    const err = await onUpdate(id, draft.nombre, draft.direccion, draft.telefono)
    setSaving(false)
    if (err) { setErrors(prev => ({ ...prev, [id]: err })); return }
    setEditingId(null)
  }

  async function handleToggle(s) {
    const err = await onToggle(s.id, s.activo)
    if (err) setErrors(prev => ({ ...prev, [s.id]: err }))
  }

  if (salones.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-8 text-center">
        <p className="text-gray-600 text-xs">Sin salones registrados. Agrega uno abajo.</p>
      </div>
    )
  }

  const inputCls = `bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
    focus:outline-none focus:border-indigo-500 transition-colors`

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_100px_80px] gap-3 px-4 py-2 border-b border-gray-800">
        {['Nombre', 'Dirección', 'Teléfono', 'Estado', ''].map((h, i) => (
          <span key={i} className="text-xs text-gray-500 font-medium uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {salones.map(s => (
        <div key={s.id} className="border-b border-gray-800/60 last:border-0">
          {editingId === s.id ? (
            <div className="px-4 py-2 space-y-2">
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_100px_80px] gap-3 items-center">
                <input
                  autoFocus
                  value={draft.nombre}
                  onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
                  placeholder="Nombre"
                  className={inputCls}
                />
                <input
                  value={draft.direccion}
                  onChange={e => setDraft(d => ({ ...d, direccion: e.target.value }))}
                  placeholder="Dirección"
                  className={inputCls}
                />
                <input
                  value={draft.telefono}
                  onChange={e => setDraft(d => ({ ...d, telefono: e.target.value }))}
                  placeholder="Teléfono"
                  className={inputCls}
                />
                <div />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSave(s.id)}
                    disabled={saving || !draft.nombre.trim()}
                    className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30
                      disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {errors[s.id] && <p className="text-xs text-red-400">{errors[s.id]}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-[1.5fr_1.5fr_1fr_100px_80px] gap-3 items-center px-4 py-3">
              <span className="text-sm text-white truncate">{s.nombre}</span>
              <span className="text-xs text-gray-400 truncate">{s.direccion ?? '—'}</span>
              <span className="text-xs text-gray-400 truncate font-mono">{s.telefono ?? '—'}</span>
              <button
                onClick={() => handleToggle(s)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  w-fit transition-colors
                  ${s.activo
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
              >
                {s.activo
                  ? <><ToggleRight size={12} /> Activo</>
                  : <><ToggleLeft  size={12} /> Inactivo</>}
              </button>
              <div className="flex justify-end">
                <button
                  onClick={() => startEdit(s)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Formulario ───────────────────────────────────────────────────────────────

const EMPTY = { nombre: '', direccion: '', telefono: '' }

function AgregarSalonForm({ onAdd }) {
  const [draft,   setDraft]   = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!draft.nombre.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    const err = await onAdd(draft.nombre, draft.direccion, draft.telefono)
    setSaving(false)
    if (err) { setError(err); return }
    setDraft(EMPTY)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 5000)
  }

  const inputCls = `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
    focus:outline-none focus:border-indigo-500 transition-colors`

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 max-w-xl space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre</label>
          <input
            value={draft.nombre}
            onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
            placeholder="Billar Tito"
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Dirección</label>
          <input
            value={draft.direccion}
            onChange={e => setDraft(d => ({ ...d, direccion: e.target.value }))}
            placeholder="Calle 123"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Teléfono</label>
          <input
            value={draft.telefono}
            onChange={e => setDraft(d => ({ ...d, telefono: e.target.value }))}
            placeholder="+57 300 000 0000"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !draft.nombre.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Building2Plus size={14} />}
          Guardar salón
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {success && (
        <p className="text-xs text-green-400 font-medium">Salón creado correctamente.</p>
      )}
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalonesPage() {
  const { salones, loading, error, addSalon, updateSalon, toggleSalon } = useSalonesData()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando salones...</span>
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
    <div className="flex-1 overflow-y-auto p-6 space-y-8">

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest">Salones</h2>
          <span className="text-xs text-gray-500">
            {salones.filter(s => s.activo).length} activos · {salones.length} total
          </span>
        </div>
        <SalonesTable
          salones={salones}
          onUpdate={updateSalon}
          onToggle={toggleSalon}
        />
      </section>

      <div className="border-t border-gray-800" />

      <section>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
          Agregar salón
        </h2>
        <AgregarSalonForm onAdd={addSalon} />
      </section>

    </div>
  )
}
