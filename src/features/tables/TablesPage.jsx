import { useState, useEffect } from 'react'
import { Printer, Save, Trash2, AlertCircle, Loader2, X } from 'lucide-react'
import { useTablesData } from './useTablesData'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

// ─── Pool table SVG icon ─────────────────────────────────────────────────────

function PoolTableIcon({ active }) {
  return (
    <svg viewBox="0 0 64 40" className="w-12 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="60" height="36" rx="4" fill={active ? '#15803d' : '#374151'} />
      <rect x="2" y="2" width="60" height="36" rx="4" stroke={active ? '#16a34a' : '#4b5563'} strokeWidth="3" fill="none" />
      <circle cx="5"  cy="5"  r="3" fill={active ? '#052e16' : '#1f2937'} />
      <circle cx="59" cy="5"  r="3" fill={active ? '#052e16' : '#1f2937'} />
      <circle cx="5"  cy="35" r="3" fill={active ? '#052e16' : '#1f2937'} />
      <circle cx="59" cy="35" r="3" fill={active ? '#052e16' : '#1f2937'} />
      <circle cx="32" cy="3"  r="2.5" fill={active ? '#052e16' : '#1f2937'} />
      <circle cx="32" cy="37" r="2.5" fill={active ? '#052e16' : '#1f2937'} />
    </svg>
  )
}

// ─── Live timer ──────────────────────────────────────────────────────────────

function TableTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])

  if (!startTime) return <span className="text-gray-600 text-xs">--:--</span>

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return (
    <span className="text-green-400 text-xs font-mono">
      {h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`}
    </span>
  )
}

// ─── Table card ──────────────────────────────────────────────────────────────

function TableCard({ table, isSelected, onSelect, onOpen, onClose }) {
  const active = table.status === 'active'
  return (
    <div
      onClick={() => onSelect(table.id)}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer border-2 transition-all
        ${isSelected
          ? 'border-indigo-500 bg-gray-800'
          : 'border-transparent bg-gray-800/50 hover:bg-gray-800'}`}
    >
      {active && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      )}
      <PoolTableIcon active={active} />
      <span className={`text-xs font-semibold ${active ? 'text-green-400' : 'text-gray-400'}`}>
        {table.name}
      </span>
      <TableTimer startTime={table.startTime} />
      {active ? (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(table.id) }}
          className="mt-1 w-full text-xs px-2 py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-600/40 hover:bg-red-600/30 transition-colors"
        >
          Cerrar Mesa
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(table.id) }}
          className="mt-1 w-full text-xs px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-600/40 hover:bg-indigo-600/30 transition-colors"
        >
          Abrir Mesa
        </button>
      )}
    </div>
  )
}

// ─── Products panel (centre) ─────────────────────────────────────────────────

function ProductsPanel({ products, selectedId, onAddProduct }) {
  const [alert, setAlert] = useState(false)

  function handleClick(product) {
    if (!selectedId) {
      setAlert(true)
      setTimeout(() => setAlert(false), 2500)
      return
    }
    onAddProduct(product)
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-3">Productos</h2>

      {alert && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          <AlertCircle size={14} />
          Selecciona una mesa antes de agregar productos.
        </div>
      )}

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-3 overflow-x-auto overflow-y-hidden">
        <div className="grid grid-rows-7 grid-flow-col gap-2 h-full auto-cols-max">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => handleClick(product)}
              className="flex flex-col items-start justify-center w-32 px-3 py-2.5 rounded-xl
                bg-gray-800 hover:bg-indigo-600/20 hover:border-indigo-500/50
                border border-gray-700 transition-all text-left"
            >
              <span className="text-white text-xs font-medium leading-tight line-clamp-2">
                {product.name}
              </span>
              <span className="text-indigo-400 text-xs font-mono mt-1">
                {fmt(product.price)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Account panel (right) ───────────────────────────────────────────────────

function AccountPanel({ selectedTable, lines, onDeleteLine, onSave, onPrint }) {
  const [selectedLine, setSelectedLine] = useState(null)

  useEffect(() => { setSelectedLine(null) }, [selectedTable?.id])

  const total    = lines.reduce((s, l) => s + l.valorTotal, 0)
  const totalIva = lines.reduce((s, l) => s + l.iva, 0)

  function handleDelete() {
    if (selectedLine === null) return
    const consumoId = lines[selectedLine]?.consumoId
    if (!consumoId) return
    onDeleteLine(consumoId)
    setSelectedLine(null)
  }

  return (
    <div className="flex flex-col w-[420px] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-bold text-sm uppercase tracking-widest">
          {selectedTable ? `Cuenta — ${selectedTable.name}` : 'Cuenta'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={!selectedTable || lines.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={13} /> Guardar factura
          </button>
          <button
            onClick={onPrint}
            disabled={!selectedTable || lines.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Delete button bar */}
        <div className="flex items-center px-3 pt-3 pb-2 border-b border-gray-800">
          <button
            onClick={handleDelete}
            disabled={selectedLine === null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-red-600/20 text-red-400 border border-red-600/30
              hover:bg-red-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={13} /> Eliminar producto
          </button>
          {selectedLine !== null && (
            <span className="ml-3 text-xs text-gray-500">
              Fila {selectedLine + 1} seleccionada
            </span>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-900">
                <th className="text-left px-3 py-2 font-medium">Código</th>
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-right px-3 py-2 font-medium">Cant</th>
                <th className="text-right px-3 py-2 font-medium">V. Unit</th>
                <th className="text-right px-3 py-2 font-medium">IVA</th>
                <th className="text-right px-3 py-2 font-medium">V. Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-700 py-10">
                    {selectedTable ? 'Sin productos en la cuenta' : 'Selecciona una mesa'}
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedLine(idx === selectedLine ? null : idx)}
                    className={`cursor-pointer border-b border-gray-800/50 transition-colors
                      ${idx === selectedLine
                        ? 'bg-indigo-600/20 text-white'
                        : 'text-gray-300 hover:bg-gray-800/60'}`}
                  >
                    <td className="px-3 py-2 font-mono text-gray-500">{line.code}</td>
                    <td className="px-3 py-2">{line.name}</td>
                    <td className="px-3 py-2 text-right">{line.qty}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(line.price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-500/80">{fmt(line.iva)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-400">{fmt(line.valorTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        <div className="border-t border-gray-700 px-4 py-3 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>IVA</span>
            <span className="font-mono">{fmt(totalIva)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white">
            <span>TOTAL</span>
            <span className="font-mono text-green-400">{fmt(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal confirmación cierre ───────────────────────────────────────────────

function ConfirmCloseModal({ table, lines, precioHora, onConfirm, onCancel, closing }) {
  const mins        = table.startTime ? Math.floor((Date.now() - table.startTime) / 60000) : 0
  const valorTiempo = (mins / 60) * precioHora
  const valorConsumo = lines.reduce((s, l) => s + l.valorTotal, 0)
  const total       = valorTiempo + valorConsumo

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <p className="text-white font-bold text-sm">¿Cerrar {table.name}?</p>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Resumen */}
        <div className="px-5 py-4 space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Tiempo jugado</span>
            <span className="font-mono text-white">{mins} min</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Valor tiempo</span>
            <span className="font-mono text-indigo-400">{fmt(valorTiempo)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Consumos ({lines.length} ítem{lines.length !== 1 ? 's' : ''})</span>
            <span className="font-mono text-amber-400">{fmt(valorConsumo)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-gray-800">
            <span>TOTAL</span>
            <span className="font-mono text-green-400">{fmt(total)}</span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-800">
          <button
            onClick={onCancel}
            disabled={closing}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm
              hover:bg-gray-600 disabled:opacity-40 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={closing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
              bg-red-600 text-white text-sm font-medium hover:bg-red-500
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {closing ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirmar y cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TablesPage() {
  const { tables, products, cuentas, precioHora, loading, error, openTable, closeTable, addProduct, deleteLine } = useTablesData()
  const [selectedId,   setSelectedId]   = useState(null)
  const [pendingClose, setPendingClose] = useState(null) // { id }
  const [closing,      setClosing]      = useState(false)

  async function handleOpen(id) {
    const err = await openTable(id)
    if (err) {
      alert(`Error abriendo mesa: ${err}`)
      return
    }
    setSelectedId(id)
  }

  function handleClose(id) {
    setPendingClose({ id })
  }

  async function confirmClose() {
    if (!pendingClose) return
    setClosing(true)
    const err = await closeTable(pendingClose.id)
    setClosing(false)
    if (err) {
      alert(`Error cerrando mesa: ${err}`)
      return
    }
    if (selectedId === pendingClose.id) setSelectedId(null)
    setPendingClose(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando mesas y productos...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-red-400 text-sm font-medium">Error al cargar datos</p>
          <p className="text-gray-600 text-xs max-w-sm">{error}</p>
        </div>
      </div>
    )
  }

  async function handleAddProduct(product) {
    const err = await addProduct(selectedId, product)
    if (err) alert(`Error agregando producto: ${err}`)
  }

  async function handleDeleteLine(consumoId) {
    const err = await deleteLine(selectedId, consumoId)
    if (err) alert(`Error eliminando producto: ${err}`)
  }

  function handleSave() {
    if (selectedId) handleClose(selectedId)
  }

  function handlePrint() {
    alert(`Imprimiendo cuenta de ${selectedTable?.name} (simulado).`)
  }

  const activeTables  = tables.filter(t => t.status === 'active').length
  const selectedTable = tables.find(t => t.id === selectedId) ?? null
  const currentLines  = selectedId ? (cuentas[selectedId] ?? []) : []

  return (
    <>
    <div className="flex h-full gap-4 p-4 overflow-hidden">

      {/* LEFT — Mesa grid */}
      <div className="flex flex-col w-72 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest">Mesas</h2>
          <span className="text-xs text-gray-500">{activeTables} activas</span>
        </div>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {tables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                isSelected={selectedId === table.id}
                onSelect={setSelectedId}
                onOpen={handleOpen}
                onClose={handleClose}
              />
            ))}
          </div>
        </div>
      </div>

      {/* CENTRE — Products */}
      <ProductsPanel products={products} selectedId={selectedId} onAddProduct={handleAddProduct} />

      {/* RIGHT — Account */}
      <AccountPanel
        selectedTable={selectedTable}
        lines={currentLines}
        onDeleteLine={handleDeleteLine}
        onSave={handleSave}
        onPrint={handlePrint}
      />

    </div>

    {/* Modal confirmación cierre */}
    {pendingClose && (() => {
      const table = tables.find(t => t.id === pendingClose.id)
      const lines = cuentas[pendingClose.id] ?? []
      if (!table) return null
      return (
        <ConfirmCloseModal
          table={table}
          lines={lines}
          precioHora={precioHora}
          onConfirm={confirmClose}
          onCancel={() => setPendingClose(null)}
          closing={closing}
        />
      )
    })()}
    </>
  )
}
