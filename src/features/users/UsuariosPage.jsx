import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Loader2, Pencil, X, Check, ToggleLeft, ToggleRight, UserPlus } from 'lucide-react'

const SALON_NAME = 'Billar Tito'

const ROLES = [
  { value: 'operador', label: 'Operador' },
  { value: 'admin',    label: 'Admin'    },
]

// ─── Hook ────────────────────────────────────────────────────────────────────

function useUsuariosData() {
  const [salonId,   setSalonId]   = useState(null)
  const [usuarios,  setUsuarios]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: salons, error: salonErr } = await supabase
          .from('salones')
          .select('id')
          .eq('nombre', SALON_NAME)
          .limit(1)

        if (salonErr) throw salonErr
        if (!salons?.length) throw new Error(`Salón "${SALON_NAME}" no encontrado.`)

        const id = salons[0].id

        const { data, error: usrErr } = await supabase
          .from('usuarios')
          .select('id, nombre, email, rol, activo')
          .eq('salon_id', id)
          .order('nombre')

        if (usrErr) throw usrErr

        if (!cancelled) {
          setSalonId(id)
          setUsuarios(data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Error cargando usuarios')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function addUsuario(nombre, email, rol) {
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ salon_id: salonId, nombre: nombre.trim(), email: email.trim(), rol })
      .select('id, nombre, email, rol, activo')
      .single()

    if (error) return { dbError: error.message }

    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!'
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: tempPassword,
    })
    if (signUpError && signUpError.message !== 'User already registered') {
      return { dbError: signUpError.message }
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: 'https://billar-pro-orpin.vercel.app/reset-password' },
    )
    if (resetError) return { dbError: resetError.message }

    setUsuarios(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
  }

  async function updateUsuario(id, nombre, email, rol) {
    const { error } = await supabase
      .from('usuarios')
      .update({ nombre: nombre.trim(), email: email.trim(), rol })
      .eq('id', id)

    if (error) return error.message
    setUsuarios(prev =>
      prev
        .map(u => u.id === id ? { ...u, nombre: nombre.trim(), email: email.trim(), rol } : u)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
  }

  async function toggleUsuario(id, activo) {
    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !activo })
      .eq('id', id)

    if (error) return error.message
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: !activo } : u))
  }

  return { usuarios, loading, error, addUsuario, updateUsuario, toggleUsuario }
}

// ─── Rol badge ────────────────────────────────────────────────────────────────

function RolBadge({ rol }) {
  const styles = {
    admin:      'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
    operador:   'bg-gray-700 text-gray-300 border border-gray-600',
    superadmin: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[rol] ?? styles.operador}`}>
      {rol}
    </span>
  )
}

// ─── Rol select ───────────────────────────────────────────────────────────────

function RolSelect({ value, onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
        focus:outline-none focus:border-indigo-500 transition-colors ${className}`}
    >
      {ROLES.map(r => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  )
}

// ─── Sección 1: Tabla de usuarios ────────────────────────────────────────────

function UsuariosTable({ usuarios, onUpdate, onToggle }) {
  const [editingId, setEditingId] = useState(null)
  const [draft,     setDraft]     = useState({ nombre: '', email: '', rol: 'operador' })
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState({})

  function clearError(key) {
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function startEdit(u) {
    setEditingId(u.id)
    setDraft({ nombre: u.nombre, email: u.email, rol: u.rol })
    clearError(u.id)
  }

  async function handleSave(id) {
    if (!draft.nombre.trim() || !draft.email.trim()) return
    setSaving(true)
    const err = await onUpdate(id, draft.nombre, draft.email, draft.rol)
    setSaving(false)
    if (err) { setErrors(prev => ({ ...prev, [id]: err })); return }
    setEditingId(null)
    clearError(id)
  }

  async function handleToggle(u) {
    const err = await onToggle(u.id, u.activo)
    if (err) setErrors(prev => ({ ...prev, [u.id]: err }))
  }

  if (usuarios.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-8 text-center">
        <p className="text-gray-600 text-xs">Sin usuarios registrados. Agrega uno abajo.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-3 px-4 py-2 border-b border-gray-800">
        {['Nombre', 'Email', 'Rol', 'Estado', ''].map((h, i) => (
          <span key={i} className="text-xs text-gray-500 font-medium uppercase tracking-wide">{h}</span>
        ))}
      </div>

      {usuarios.map(u => (
        <div key={u.id} className="border-b border-gray-800/60 last:border-0">
          {editingId === u.id ? (
            /* Edit row */
            <div className="px-4 py-2 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-3 items-center">
                <input
                  autoFocus
                  value={draft.nombre}
                  onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
                  placeholder="Nombre"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
                    focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <input
                  type="email"
                  value={draft.email}
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                  placeholder="Email"
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
                    focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <RolSelect value={draft.rol} onChange={v => setDraft(d => ({ ...d, rol: v }))} />
                <div /> {/* estado no editable inline */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSave(u.id)}
                    disabled={saving}
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
              {errors[u.id] && <p className="text-xs text-red-400">{errors[u.id]}</p>}
            </div>
          ) : (
            /* View row */
            <div className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-3 items-center px-4 py-3">
              <span className="text-sm text-white truncate">{u.nombre}</span>
              <span className="text-xs text-gray-400 truncate font-mono">{u.email}</span>
              <RolBadge rol={u.rol} />
              <button
                onClick={() => handleToggle(u)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  w-fit transition-colors
                  ${u.activo
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
              >
                {u.activo
                  ? <><ToggleRight size={12} /> Activo</>
                  : <><ToggleLeft  size={12} /> Inactivo</>}
              </button>
              <div className="flex justify-end">
                <button
                  onClick={() => startEdit(u)}
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

// ─── Sección 2: Agregar usuario ───────────────────────────────────────────────

const EMPTY = { nombre: '', email: '', rol: 'operador' }

function AgregarUsuarioForm({ onAdd }) {
  const [draft,   setDraft]   = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!draft.nombre.trim() || !draft.email.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await onAdd(draft.nombre, draft.email, draft.rol)
    setSaving(false)
    if (result?.dbError) { setError(result.dbError); return }
    setDraft(EMPTY)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 12000)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre</label>
          <input
            value={draft.nombre}
            onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
            placeholder="Nombre completo"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={draft.email}
            onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
            placeholder="correo@ejemplo.com"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div className="w-40">
        <label className="block text-xs text-gray-400 mb-1">Rol</label>
        <RolSelect
          value={draft.rol}
          onChange={v => setDraft(d => ({ ...d, rol: v }))}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !draft.nombre.trim() || !draft.email.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Guardar usuario
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {success && (
        <p className="text-xs text-green-400 font-medium">
          Usuario creado. Se envió un correo de invitación a su email.
        </p>
      )}
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { usuarios, loading, error, addUsuario, updateUsuario, toggleUsuario } = useUsuariosData()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando usuarios...</span>
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

      {/* Sección 1 — Lista */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest">Usuarios</h2>
          <span className="text-xs text-gray-500">
            {usuarios.filter(u => u.activo).length} activos · {usuarios.length} total
          </span>
        </div>
        <UsuariosTable
          usuarios={usuarios}
          onUpdate={updateUsuario}
          onToggle={toggleUsuario}
        />
      </section>

      <div className="border-t border-gray-800" />

      {/* Sección 2 — Agregar */}
      <section>
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
          Agregar usuario
        </h2>
        <AgregarUsuarioForm onAdd={addUsuario} />
      </section>

    </div>
  )
}
