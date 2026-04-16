import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, X, Check, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

const SALON_NAME = 'Billar Tito'

const TAX_OPTIONS = [
  { label: 'Sin IVA (0%)',   value: 0     },
  { label: 'IVA 19% (0.19)', value: 0.19  },
]

function fmtPrecio(n) {
  return '$' + Number(n).toLocaleString('es-CO')
}

function fmtTax(n) {
  return Number(n) === 0 ? 'Sin IVA' : `${Math.round(Number(n) * 100)}%`
}

// ─── Hook ────────────────────────────────────────────────────────────────────

function useProductosData() {
  const [salonId,   setSalonId]   = useState(null)
  const [productos, setProductos] = useState([])
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

        const { data, error: prodErr } = await supabase
          .from('productos')
          .select('id, codigo, nombre, precio, tax_rate, activo')
          .eq('salon_id', id)
          .order('codigo')

        if (prodErr) throw prodErr

        if (!cancelled) {
          setSalonId(id)
          setProductos(data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Error cargando productos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function addProducto(fields) {
    const { data, error } = await supabase
      .from('productos')
      .insert({
        salon_id: salonId,
        codigo:   fields.codigo.trim(),
        nombre:   fields.nombre.trim(),
        precio:   Number(fields.precio),
        tax_rate: Number(fields.tax_rate),
        activo:   fields.activo,
      })
      .select('id, codigo, nombre, precio, tax_rate, activo')
      .single()

    if (error) return error.message
    setProductos(prev => [...prev, data].sort((a, b) => a.codigo.localeCompare(b.codigo)))
  }

  async function updateProducto(id, fields) {
    const { error } = await supabase
      .from('productos')
      .update({
        codigo:   fields.codigo.trim(),
        nombre:   fields.nombre.trim(),
        precio:   Number(fields.precio),
        tax_rate: Number(fields.tax_rate),
      })
      .eq('id', id)

    if (error) return error.message
    setProductos(prev =>
      prev
        .map(p => p.id === id ? { ...p, ...fields, precio: Number(fields.precio), tax_rate: Number(fields.tax_rate) } : p)
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
    )
  }

  async function toggleProducto(id, activo) {
    const { error } = await supabase
      .from('productos')
      .update({ activo: !activo })
      .eq('id', id)

    if (error) return error.message
    setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: !activo } : p))
  }

  return { productos, loading, error, addProducto, updateProducto, toggleProducto }
}

// ─── Empty draft ──────────────────────────────────────────────────────────────

const EMPTY_DRAFT = { codigo: '', nombre: '', precio: '', tax_rate: 0, activo: true }

// ─── Inline text input ────────────────────────────────────────────────────────

function InlineInput({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={type === 'number' ? 0 : undefined}
      className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
        focus:outline-none focus:border-indigo-500 transition-colors ${className}`}
    />
  )
}

// ─── Tax select ───────────────────────────────────────────────────────────────

function TaxSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white
        focus:outline-none focus:border-indigo-500 transition-colors"
    >
      {TAX_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

function ProductosTable({ productos, onAdd, onUpdate, onToggle }) {
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT)
  const [addDraft,  setAddDraft]  = useState(EMPTY_DRAFT)
  const [saving,    setSaving]    = useState(false)
  const [errors,    setErrors]    = useState({}) // id | '__add' → msg

  function clearError(key) {
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditDraft({ codigo: p.codigo, nombre: p.nombre, precio: String(p.precio), tax_rate: p.tax_rate, activo: p.activo })
    clearError(p.id)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(id) {
    if (!editDraft.codigo.trim() || !editDraft.nombre.trim() || editDraft.precio === '') return
    setSaving(true)
    const err = await onUpdate(id, editDraft)
    setSaving(false)
    if (err) { setErrors(prev => ({ ...prev, [id]: err })); return }
    setEditingId(null)
    clearError(id)
  }

  async function handleToggle(p) {
    const err = await onToggle(p.id, p.activo)
    if (err) setErrors(prev => ({ ...prev, [p.id]: err }))
  }

  async function handleAdd() {
    if (!addDraft.codigo.trim() || !addDraft.nombre.trim() || addDraft.precio === '') return
    setSaving(true)
    const err = await onAdd(addDraft)
    setSaving(false)
    if (err) { setErrors(prev => ({ ...prev, __add: err })); return }
    setAddDraft(EMPTY_DRAFT)
    clearError('__add')
  }

  const COL = 'grid-cols-[80px_1fr_110px_110px_90px_90px]'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className={`grid ${COL} gap-3 px-4 py-2 border-b border-gray-800`}>
        {['Código', 'Nombre', 'Precio', 'IVA', 'Estado', ''].map((h, i) => (
          <span key={i} className={`text-xs text-gray-500 font-medium uppercase tracking-wide ${i >= 2 ? 'text-right' : ''} ${i === 4 ? 'text-center' : ''}`}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {productos.length === 0 && (
        <p className="text-gray-600 text-xs text-center py-8">Sin productos. Agrega uno abajo.</p>
      )}

      {productos.map(p => (
        <div key={p.id} className="border-b border-gray-800/60 last:border-0">
          {editingId === p.id ? (
            /* ── Edit row ── */
            <div className="px-4 py-2 space-y-2">
              <div className={`grid ${COL} gap-3 items-center`}>
                <InlineInput
                  autoFocus
                  value={editDraft.codigo}
                  onChange={v => setEditDraft(d => ({ ...d, codigo: v }))}
                  placeholder="Código"
                />
                <InlineInput
                  value={editDraft.nombre}
                  onChange={v => setEditDraft(d => ({ ...d, nombre: v }))}
                  placeholder="Nombre"
                />
                <InlineInput
                  type="number"
                  value={editDraft.precio}
                  onChange={v => setEditDraft(d => ({ ...d, precio: v }))}
                  placeholder="0"
                  className="text-right"
                />
                <TaxSelect
                  value={editDraft.tax_rate}
                  onChange={v => setEditDraft(d => ({ ...d, tax_rate: v }))}
                />
                <div /> {/* estado — no editable inline */}
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => handleSaveEdit(p.id)}
                    disabled={saving}
                    className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {errors[p.id] && (
                <p className="text-xs text-red-400">{errors[p.id]}</p>
              )}
            </div>
          ) : (
            /* ── View row ── */
            <div className={`grid ${COL} gap-3 items-center px-4 py-2.5`}>
              <span className="text-xs font-mono text-gray-400 truncate">{p.codigo}</span>
              <span className="text-sm text-white truncate">{p.nombre}</span>
              <span className="text-sm text-indigo-400 font-mono text-right">{fmtPrecio(p.precio)}</span>
              <span className="text-sm text-amber-500/80 text-right">{fmtTax(p.tax_rate)}</span>
              <div className="flex justify-center">
                <button
                  onClick={() => handleToggle(p)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
                    ${p.activo
                      ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                >
                  {p.activo
                    ? <><ToggleRight size={12} /> Activo</>
                    : <><ToggleLeft  size={12} /> Inactivo</>}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => startEdit(p)}
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
      <div className="border-t border-gray-700 px-4 py-3 space-y-2">
        <div className={`grid ${COL} gap-3 items-center`}>
          <InlineInput
            value={addDraft.codigo}
            onChange={v => setAddDraft(d => ({ ...d, codigo: v }))}
            placeholder="Código"
          />
          <InlineInput
            value={addDraft.nombre}
            onChange={v => setAddDraft(d => ({ ...d, nombre: v }))}
            placeholder="Nombre del producto"
          />
          <InlineInput
            type="number"
            value={addDraft.precio}
            onChange={v => setAddDraft(d => ({ ...d, precio: v }))}
            placeholder="0"
            className="text-right"
          />
          <TaxSelect
            value={addDraft.tax_rate}
            onChange={v => setAddDraft(d => ({ ...d, tax_rate: v }))}
          />
          <div className="flex justify-center">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addDraft.activo}
                onChange={e => setAddDraft(d => ({ ...d, activo: e.target.checked }))}
                className="accent-indigo-500"
              />
              Activo
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={saving || !addDraft.codigo.trim() || !addDraft.nombre.trim() || addDraft.precio === ''}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium
                hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Agregar
            </button>
          </div>
        </div>
        {errors.__add && (
          <p className="text-xs text-red-400">{errors.__add}</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { productos, loading, error, addProducto, updateProducto, toggleProducto } = useProductosData()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando productos...</span>
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
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-sm uppercase tracking-widest">Productos</h2>
        <span className="text-xs text-gray-500">
          {productos.filter(p => p.activo).length} activos · {productos.length} total
        </span>
      </div>
      <ProductosTable
        productos={productos}
        onAdd={addProducto}
        onUpdate={updateProducto}
        onToggle={toggleProducto}
      />
    </div>
  )
}
