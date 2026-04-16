import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Loader2, LogIn, LogOut, Printer, Eye, Clock,
  Banknote, ShoppingCart, TableProperties, TrendingUp,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TURNO_KEY = 'billar_turno'

function fmt(n) {
  return '$' + Math.round(Number(n)).toLocaleString('es-CO')
}

function fmtHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function inicioDeHoy() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Hook ────────────────────────────────────────────────────────────────────

function useCajaData() {
  const [turno,    setTurno]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(TURNO_KEY)) ?? null }
    catch { return null }
  })
  const [facturas, setFacturas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const loadFacturas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('facturas')
        .select(`
          id, tiempo_total, valor_tiempo, valor_consumo, total, created_at,
          sesiones ( inicio, mesas ( nombre ) )
        `)
        .gte('created_at', inicioDeHoy())
        .order('created_at', { ascending: false })

      if (err) throw err
      setFacturas(data ?? [])
    } catch (e) {
      setError(e.message ?? 'Error cargando facturas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFacturas() }, [loadFacturas])

  function abrirTurno(saldoInicial, operador) {
    const t = { abierto: true, inicio: new Date().toISOString(), saldoInicial: Number(saldoInicial), operador }
    localStorage.setItem(TURNO_KEY, JSON.stringify(t))
    setTurno(t)
  }

  function cerrarTurno() {
    localStorage.removeItem(TURNO_KEY)
    setTurno(null)
  }

  async function getDetalle(sesionId) {
    const { data, error } = await supabase
      .from('consumos')
      .select('id, cantidad, precio_unit, subtotal, productos ( codigo, nombre )')
      .eq('sesion_id', sesionId)
      .order('created_at')
    if (error) return { error: error.message }
    return { consumos: data ?? [] }
  }

  return { turno, facturas, loading, error, abrirTurno, cerrarTurno, getDetalle, reload: loadFacturas }
}

// ─── Sección 1: Turno ─────────────────────────────────────────────────────────

function TurnoPanel({ turno, onAbrir, onCerrar }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [draft, setDraft] = useState({ saldoInicial: '', operador: '' })

  function handleAbrir(e) {
    e.preventDefault()
    if (!draft.operador.trim()) return
    onAbrir(draft.saldoInicial || 0, draft.operador.trim())
    setMostrarForm(false)
    setDraft({ saldoInicial: '', operador: '' })
  }

  if (turno?.abierto) {
    return (
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-semibold">Turno abierto</span>
          </div>
          <p className="text-gray-400 text-xs">Inicio: {fmtFecha(turno.inicio)}</p>
          <p className="text-gray-400 text-xs">Operador: <span className="text-white">{turno.operador}</span></p>
          <p className="text-gray-400 text-xs">Saldo inicial: <span className="text-indigo-400 font-mono">{fmt(turno.saldoInicial)}</span></p>
        </div>
        <button
          onClick={onCerrar}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400
            border border-red-600/30 hover:bg-red-600/30 text-sm font-medium transition-colors"
        >
          <LogOut size={14} /> Cerrar turno
        </button>
      </div>
    )
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleAbrir} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Operador</label>
          <input
            autoFocus
            value={draft.operador}
            onChange={e => setDraft(d => ({ ...d, operador: e.target.value }))}
            placeholder="Nombre del operador"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Saldo inicial en caja</label>
          <input
            type="number"
            min="0"
            value={draft.saldoInicial}
            onChange={e => setDraft(d => ({ ...d, saldoInicial: e.target.value }))}
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!draft.operador.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <LogIn size={14} /> Abrir turno
          </button>
          <button
            type="button"
            onClick={() => setMostrarForm(false)}
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-gray-600" />
        <span className="text-gray-500 text-sm">Sin turno abierto</span>
      </div>
      <button
        onClick={() => setMostrarForm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
          hover:bg-indigo-500 transition-colors"
      >
        <LogIn size={14} /> Abrir turno
      </button>
    </div>
  )
}

// ─── Modal detalle factura ────────────────────────────────────────────────────

function DetalleModal({ factura, numero, onClose }) {
  const [consumos, setConsumos] = useState(null)
  const [loadingD, setLoadingD] = useState(true)
  const [errorD,   setErrorD]   = useState(null)

  const sesionId = factura.sesiones?.id ?? factura.sesion_id

  useEffect(() => {
    async function load() {
      setLoadingD(true)
      const { data, error } = await supabase
        .from('consumos')
        .select('id, cantidad, precio_unit, subtotal, productos ( codigo, nombre )')
        .eq('sesion_id', sesionId)
        .order('created_at')
      setLoadingD(false)
      if (error) { setErrorD(error.message); return }
      setConsumos(data ?? [])
    }
    if (sesionId) load()
  }, [sesionId])

  const mesaNombre = factura.sesiones?.mesas?.nombre ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden print:shadow-none">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-white font-bold text-sm">Factura #{numero}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {mesaNombre} · {fmtFecha(factura.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors print:hidden">✕</button>
        </div>

        {/* Consumos */}
        <div className="px-5 py-4 max-h-64 overflow-y-auto">
          {loadingD && <p className="text-gray-500 text-xs text-center py-4">Cargando...</p>}
          {errorD   && <p className="text-red-400 text-xs">{errorD}</p>}
          {consumos?.length === 0 && (
            <p className="text-gray-600 text-xs text-center py-4">Sin consumos registrados</p>
          )}
          {consumos && consumos.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1 font-medium">Producto</th>
                  <th className="text-right py-1 font-medium">Cant</th>
                  <th className="text-right py-1 font-medium">Unit</th>
                  <th className="text-right py-1 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {consumos.map(c => (
                  <tr key={c.id} className="text-gray-300 border-b border-gray-800/40">
                    <td className="py-1.5">{c.productos?.nombre ?? '—'}</td>
                    <td className="py-1.5 text-right">{c.cantidad}</td>
                    <td className="py-1.5 text-right font-mono">{fmt(c.precio_unit)}</td>
                    <td className="py-1.5 text-right font-mono text-green-400">{fmt(c.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totales */}
        <div className="border-t border-gray-800 px-5 py-3 space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Tiempo ({factura.tiempo_total} min)</span>
            <span className="font-mono">{fmt(factura.valor_tiempo)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Consumos</span>
            <span className="font-mono">{fmt(factura.valor_consumo)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-gray-800">
            <span>TOTAL</span>
            <span className="font-mono text-green-400">{fmt(factura.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm
              hover:bg-gray-600 transition-colors"
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sección 2: Lista de facturas ─────────────────────────────────────────────

function FacturasTable({ facturas, onVerDetalle }) {
  if (facturas.length === 0) {
    return (
      <p className="text-gray-600 text-xs text-center py-8">
        No hay facturas registradas hoy.
      </p>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[50px_1fr_80px_110px_110px_110px_90px] gap-3 px-4 py-2 border-b border-gray-800">
        {['#', 'Mesa', 'Hora', 'Tiempo', 'Consumos', 'Total', ''].map((h, i) => (
          <span key={i} className={`text-xs text-gray-500 font-medium uppercase tracking-wide ${i >= 3 ? 'text-right' : ''}`}>
            {h}
          </span>
        ))}
      </div>

      {facturas.map((f, idx) => {
        const numero = facturas.length - idx
        const mesa   = f.sesiones?.mesas?.nombre ?? '—'
        const hora   = fmtHora(f.created_at)
        return (
          <div key={f.id} className="grid grid-cols-[50px_1fr_80px_110px_110px_110px_90px] gap-3 items-center
            px-4 py-2.5 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors">
            <span className="text-xs font-mono text-gray-500">#{numero}</span>
            <span className="text-sm text-white truncate">{mesa}</span>
            <span className="text-xs text-gray-400">{hora}</span>
            <span className="text-sm font-mono text-right text-gray-300">{fmt(f.valor_tiempo)}</span>
            <span className="text-sm font-mono text-right text-amber-500/80">{fmt(f.valor_consumo)}</span>
            <span className="text-sm font-mono text-right text-green-400 font-semibold">{fmt(f.total)}</span>
            <div className="flex justify-end gap-1">
              <button
                onClick={() => onVerDetalle(f, numero)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                title="Ver detalle"
              >
                <Eye size={13} />
              </button>
              <button
                onClick={() => onVerDetalle(f, numero)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                title="Reimprimir"
              >
                <Printer size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sección 3: Resumen ───────────────────────────────────────────────────────

function ResumenPanel({ facturas }) {
  const totalIngresos  = facturas.reduce((s, f) => s + Number(f.total), 0)
  const totalTiempo    = facturas.reduce((s, f) => s + Number(f.valor_tiempo), 0)
  const totalConsumo   = facturas.reduce((s, f) => s + Number(f.valor_consumo), 0)
  const mesasAtendidas = facturas.length

  const stats = [
    { icon: TrendingUp,      label: 'Total ingresos',     value: fmt(totalIngresos),  color: 'text-green-400' },
    { icon: Clock,           label: 'Valor tiempo',        value: fmt(totalTiempo),    color: 'text-indigo-400' },
    { icon: ShoppingCart,    label: 'Valor consumos',      value: fmt(totalConsumo),   color: 'text-amber-400' },
    { icon: TableProperties, label: 'Mesas atendidas',     value: mesasAtendidas,      color: 'text-white' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Icon size={14} />
            <span className="text-xs uppercase tracking-wide">{label}</span>
          </div>
          <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CajaPage() {
  const { turno, facturas, loading, error, abrirTurno, cerrarTurno } = useCajaData()
  const [detalle, setDetalle] = useState(null) // { factura, numero }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando caja...</span>
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
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* Sección 1 — Turno */}
        <section>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
            Turno actual
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
            <TurnoPanel turno={turno} onAbrir={abrirTurno} onCerrar={cerrarTurno} />
          </div>
        </section>

        {/* Sección 3 — Resumen (arriba de la lista para visibilidad inmediata) */}
        <section>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
            Resumen del turno
          </h2>
          <ResumenPanel facturas={facturas} />
        </section>

        {/* Sección 2 — Facturas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">
              Facturas del turno
            </h2>
            <span className="text-xs text-gray-500">{facturas.length} facturas · hoy</span>
          </div>
          <FacturasTable
            facturas={facturas}
            onVerDetalle={(f, n) => setDetalle({ factura: f, numero: n })}
          />
        </section>

      </div>

      {/* Modal detalle */}
      {detalle && (
        <DetalleModal
          factura={detalle.factura}
          numero={detalle.numero}
          onClose={() => setDetalle(null)}
        />
      )}
    </>
  )
}
