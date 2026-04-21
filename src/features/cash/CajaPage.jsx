import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  Loader2, LogIn, LogOut, Printer, Eye, Clock, X,
  Banknote, ShoppingCart, TableProperties, TrendingUp,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TURNO_KEY = 'billar_turno_id'

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

// ─── Hook ────────────────────────────────────────────────────────────────────

function useCajaData() {
  const nombre            = useAuthStore(s => s.nombre)
  const salonId           = useAuthStore(s => s.salonId)
  const salonSeleccionado = useAuthStore(s => s.salonSeleccionado)
  const user              = useAuthStore(s => s.user)
  const activeSalonId     = salonSeleccionado?.id ?? salonId

  const [turno,    setTurno]    = useState(null)
  const [facturas, setFacturas] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const loadFacturas = useCallback(async (turnoId) => {
    if (!turnoId) { setFacturas([]); return }
    try {
      const { data, error: err } = await supabase
        .from('facturas')
        .select(`
          id, sesion_id, tiempo_total, valor_tiempo, valor_consumo, total, created_at,
          sesiones ( id, inicio, mesas ( nombre ) )
        `)
        .eq('turno_id', turnoId)
        .order('created_at', { ascending: false })
      if (err) throw err
      setFacturas(data ?? [])
    } catch (e) {
      setError(e.message ?? 'Error cargando facturas')
    }
  }, [])

  // Al montar: recuperar turno activo desde localStorage → verificar en Supabase
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const savedId = localStorage.getItem(TURNO_KEY)
        if (savedId) {
          const { data } = await supabase
            .from('turnos')
            .select('id, nombre_operador, saldo_inicial, inicio, estado')
            .eq('id', savedId)
            .eq('estado', 'abierto')
            .eq('salon_id', activeSalonId)
            .maybeSingle()
          if (data) {
            setTurno(data)
            await loadFacturas(data.id)
          } else {
            localStorage.removeItem(TURNO_KEY)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [loadFacturas])

  async function abrirTurno(saldoInicial) {
    if (!user?.id || !activeSalonId) return 'Sesión inválida'
    const { data, error: err } = await supabase
      .from('turnos')
      .insert({
        salon_id:        activeSalonId,
        usuario_id:      user.id,
        nombre_operador: nombre ?? user.email,
        saldo_inicial:   Number(saldoInicial),
        estado:          'abierto',
      })
      .select('id, nombre_operador, saldo_inicial, inicio, estado')
      .single()
    if (err) return err.message
    localStorage.setItem(TURNO_KEY, data.id)
    setTurno(data)
    await loadFacturas(data.id)
  }

  async function cerrarTurno(totalReal) {
    if (!turno) return
    const total_sistema = facturas.reduce((s, f) => s + Number(f.total), 0)
    const diferencia    = Number(totalReal) - total_sistema
    const { error: err } = await supabase
      .from('turnos')
      .update({
        fin:           new Date().toISOString(),
        total_sistema,
        total_real:    Number(totalReal),
        diferencia,
        estado:        'cerrado',
      })
      .eq('id', turno.id)
    if (err) return err.message
    localStorage.removeItem(TURNO_KEY)
    setTurno(null)
    setFacturas([])
  }

  return {
    turno, facturas, loading, error,
    abrirTurno, cerrarTurno,
    reload: () => loadFacturas(turno?.id),
  }
}

// ─── Modal cerrar turno ───────────────────────────────────────────────────────

function CerrarTurnoModal({ facturas, onConfirmar, onCancelar }) {
  const [totalReal, setTotalReal] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  const totalSistema = facturas.reduce((s, f) => s + Number(f.total), 0)
  const diferencia   = totalReal !== '' ? Number(totalReal) - totalSistema : null

  async function handleConfirmar() {
    if (totalReal === '') return
    setSaving(true)
    setError(null)
    const err = await onConfirmar(Number(totalReal))
    if (err) { setError(err); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Cerrar turno</h3>
          <button onClick={onCancelar} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total sistema</span>
            <span className="font-mono text-white font-semibold">{fmt(totalSistema)}</span>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Dinero real contado en caja</label>
            <input
              autoFocus
              type="number"
              min="0"
              value={totalReal}
              onChange={e => setTotalReal(e.target.value)}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {diferencia !== null && (
            <div className={`flex justify-between text-sm font-semibold rounded-lg px-3 py-2
              ${diferencia >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              <span>{diferencia >= 0 ? 'Sobrante' : 'Faltante'}</span>
              <span className="font-mono">{fmt(Math.abs(diferencia))}</span>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={saving || totalReal === ''}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
              hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            Confirmar cierre
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sección 1: Turno ─────────────────────────────────────────────────────────

function TurnoPanel({ turno, facturas, onAbrir, onCerrar }) {
  const [mostrarForm,   setMostrarForm]   = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [saldoInicial,  setSaldoInicial]  = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState(null)

  async function handleAbrir(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onAbrir(saldoInicial || 0)
    setSaving(false)
    if (err) { setError(err); return }
    setMostrarForm(false)
    setSaldoInicial('')
  }

  if (turno) {
    return (
      <>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-semibold">Turno abierto</span>
            </div>
            <p className="text-gray-400 text-xs">Inicio: {fmtFecha(turno.inicio)}</p>
            <p className="text-gray-400 text-xs">Operador: <span className="text-white">{turno.nombre_operador}</span></p>
            <p className="text-gray-400 text-xs">Saldo inicial: <span className="text-indigo-400 font-mono">{fmt(turno.saldo_inicial)}</span></p>
          </div>
          <button
            onClick={() => setMostrarCierre(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400
              border border-red-600/30 hover:bg-red-600/30 text-sm font-medium transition-colors"
          >
            <LogOut size={14} /> Cerrar turno
          </button>
        </div>

        {mostrarCierre && (
          <CerrarTurnoModal
            facturas={facturas}
            onConfirmar={async (totalReal) => {
              const err = await onCerrar(totalReal)
              if (!err) setMostrarCierre(false)
              return err
            }}
            onCancelar={() => setMostrarCierre(false)}
          />
        )}
      </>
    )
  }

  if (mostrarForm) {
    return (
      <form onSubmit={handleAbrir} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Saldo inicial en caja</label>
          <input
            autoFocus
            type="number"
            min="0"
            value={saldoInicial}
            onChange={e => setSaldoInicial(e.target.value)}
            placeholder="0"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
              focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            Abrir turno
          </button>
          <button
            type="button"
            onClick={() => { setMostrarForm(false); setError(null) }}
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
  const salonNombre = useAuthStore(s => s.salonSeleccionado?.nombre ?? '')

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

        {/* Header tipo tiquete */}
        <div className="px-5 py-4 border-b border-gray-800 text-center relative">
          <button onClick={onClose} className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors print:hidden">✕</button>
          {salonNombre && (
            <p className="text-white font-bold text-base tracking-wide">{salonNombre}</p>
          )}
          <p className="text-gray-400 text-xs mt-0.5">Factura #{numero}</p>
          <p className="text-gray-500 text-xs">{mesaNombre}</p>
          <p className="text-gray-500 text-xs">{fmtFecha(factura.created_at)}</p>
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
        No hay facturas en este turno.
      </p>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
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
    { icon: TrendingUp,      label: 'Total ingresos',  value: fmt(totalIngresos),  color: 'text-green-400' },
    { icon: Clock,           label: 'Valor tiempo',     value: fmt(totalTiempo),    color: 'text-indigo-400' },
    { icon: ShoppingCart,    label: 'Valor consumos',   value: fmt(totalConsumo),   color: 'text-amber-400' },
    { icon: TableProperties, label: 'Mesas atendidas',  value: mesasAtendidas,      color: 'text-white' },
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
  const [detalle, setDetalle] = useState(null)

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
            <TurnoPanel
              turno={turno}
              facturas={facturas}
              onAbrir={abrirTurno}
              onCerrar={cerrarTurno}
            />
          </div>
        </section>

        {/* Sección 2 — Resumen */}
        <section>
          <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-4">
            Resumen del turno
          </h2>
          <ResumenPanel facturas={facturas} />
        </section>

        {/* Sección 3 — Facturas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">
              Facturas del turno
            </h2>
            <span className="text-xs text-gray-500">{facturas.length} facturas</span>
          </div>
          <FacturasTable
            facturas={facturas}
            onVerDetalle={(f, n) => setDetalle({ factura: f, numero: n })}
          />
        </section>

      </div>

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
