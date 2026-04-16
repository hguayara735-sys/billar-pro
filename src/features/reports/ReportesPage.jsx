import { useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Loader2, TrendingUp, Clock, ShoppingCart,
  TableProperties, BarChart2,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return '$' + Math.round(Number(n)).toLocaleString('es-CO')
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PRESETS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'ayer',   label: 'Ayer' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
]

function getRangeForPreset(preset) {
  const now   = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'hoy':
      return { start: today.toISOString(), end: now.toISOString() }

    case 'ayer': {
      const desde = new Date(today); desde.setDate(desde.getDate() - 1)
      const hasta = new Date(today); hasta.setMilliseconds(-1)
      return { start: desde.toISOString(), end: hasta.toISOString() }
    }

    case 'semana': {
      const lunes = new Date(today)
      const dia   = lunes.getDay() === 0 ? 6 : lunes.getDay() - 1 // lunes = 0
      lunes.setDate(lunes.getDate() - dia)
      return { start: lunes.toISOString(), end: now.toISOString() }
    }

    case 'mes': {
      const primero = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: primero.toISOString(), end: now.toISOString() }
    }

    default:
      return null
  }
}

// ─── Aggregations (pure JS) ───────────────────────────────────────────────────

function buildResumen(facturas) {
  const total        = facturas.reduce((s, f) => s + Number(f.total),         0)
  const valTiempo    = facturas.reduce((s, f) => s + Number(f.valor_tiempo),   0)
  const valConsumo   = facturas.reduce((s, f) => s + Number(f.valor_consumo),  0)
  const mesas        = facturas.length
  const promedio     = mesas > 0 ? total / mesas : 0
  return { total, valTiempo, valConsumo, mesas, promedio }
}

function buildIngresosPorDia(facturas) {
  const map = {}
  for (const f of facturas) {
    const k = dateKey(f.created_at)
    if (!map[k]) map[k] = { fecha: k, mesas: 0, total: 0 }
    map[k].mesas++
    map[k].total += Number(f.total)
  }
  return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function buildMesasUsadas(facturas) {
  const map = {}
  for (const f of facturas) {
    const nombre = f.sesiones?.mesas?.nombre ?? '(desconocida)'
    if (!map[nombre]) map[nombre] = { mesa: nombre, sesiones: 0, total: 0 }
    map[nombre].sesiones++
    map[nombre].total += Number(f.total)
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
}

function buildProductos(consumos) {
  const map = {}
  for (const c of consumos) {
    const nombre = c.productos?.nombre ?? '(desconocido)'
    if (!map[nombre]) map[nombre] = { producto: nombre, cantidad: 0, total: 0 }
    map[nombre].cantidad += Number(c.cantidad)
    map[nombre].total    += Number(c.subtotal)
  }
  return Object.values(map).sort((a, b) => b.cantidad - a.cantidad)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

function useReportesData() {
  const [facturas, setFacturas] = useState([])
  const [consumos, setConsumos] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [applied,  setApplied]  = useState(null) // { start, end } last applied

  const fetch = useCallback(async (start, end) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Facturas with mesa name
      const { data: facturasData, error: facturasErr } = await supabase
        .from('facturas')
        .select('id, sesion_id, total, valor_tiempo, valor_consumo, created_at, sesiones(mesa_id, mesas(nombre))')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })

      if (facturasErr) throw facturasErr

      const rows      = facturasData ?? []
      const sesionIds = rows.map(f => f.sesion_id).filter(Boolean)

      // 2. Consumos for those sesiones
      let consumosData = []
      if (sesionIds.length > 0) {
        const { data, error: consumosErr } = await supabase
          .from('consumos')
          .select('sesion_id, cantidad, subtotal, productos(nombre)')
          .in('sesion_id', sesionIds)

        if (consumosErr) throw consumosErr
        consumosData = data ?? []
      }

      setFacturas(rows)
      setConsumos(consumosData)
      setApplied({ start, end })
    } catch (e) {
      setError(e.message ?? 'Error cargando reportes')
    } finally {
      setLoading(false)
    }
  }, [])

  return { facturas, consumos, loading, error, applied, fetch }
}

// ─── Sección 1: Filtros ───────────────────────────────────────────────────────

function FiltrosPanel({ onApply, loading }) {
  const [preset, setPreset]  = useState('hoy')
  const [desde,  setDesde]   = useState('')
  const [hasta,  setHasta]   = useState('')

  function handleApply() {
    if (preset === 'custom') {
      if (!desde || !hasta) return
      const start = new Date(desde);         start.setHours(0, 0, 0, 0)
      const end   = new Date(hasta);         end.setHours(23, 59, 59, 999)
      onApply(start.toISOString(), end.toISOString())
    } else {
      const range = getRangeForPreset(preset)
      if (range) onApply(range.start, range.end)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Preset tabs */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${preset === p.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white
                focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <span className="text-gray-500 text-xs">→</span>
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white
                focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={loading || (preset === 'custom' && (!desde || !hasta))}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <><Loader2 size={13} className="animate-spin" /> Cargando...</>
            : <><BarChart2 size={13} /> Aplicar</>}
        </button>
      </div>
    </div>
  )
}

// ─── Sección 2: Resumen ───────────────────────────────────────────────────────

function ResumenPanel({ resumen }) {
  const stats = [
    { icon: TrendingUp,      label: 'Total ingresos',    value: fmt(resumen.total),       color: 'text-green-400' },
    { icon: Clock,           label: 'Valor tiempo',      value: fmt(resumen.valTiempo),   color: 'text-indigo-400' },
    { icon: ShoppingCart,    label: 'Valor consumos',    value: fmt(resumen.valConsumo),  color: 'text-amber-400' },
    { icon: TableProperties, label: 'Mesas atendidas',   value: resumen.mesas,            color: 'text-white' },
    { icon: BarChart2,       label: 'Promedio por mesa', value: fmt(resumen.promedio),    color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-2 text-gray-500">
            <Icon size={13} />
            <span className="text-xs uppercase tracking-wide leading-tight">{label}</span>
          </div>
          <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tabla genérica ───────────────────────────────────────────────────────────

function ReportTable({ title, headers, rows, empty }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-white text-sm font-semibold">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-600 text-xs text-center py-8">{empty}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              {headers.map(h => (
                <th key={h.label}
                  className={`px-4 py-2 text-gray-500 font-medium uppercase tracking-wide
                    ${h.right ? 'text-right' : 'text-left'}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                {headers.map(h => (
                  <td key={h.label}
                    className={`px-4 py-2.5 ${h.right ? 'text-right font-mono' : ''} ${h.color ?? 'text-gray-300'}`}>
                    {row[h.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const { facturas, consumos, loading, error, applied, fetch } = useReportesData()

  const resumen      = useMemo(() => buildResumen(facturas),         [facturas])
  const porDia       = useMemo(() => buildIngresosPorDia(facturas),  [facturas])
  const mesasUsadas  = useMemo(() => buildMesasUsadas(facturas),     [facturas])
  const productos    = useMemo(() => buildProductos(consumos),       [consumos])

  const hasData = applied !== null

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-sm uppercase tracking-widest">Reportes</h2>
        {applied && (
          <span className="text-xs text-gray-500">
            {fmtFecha(applied.start)} → {fmtFecha(applied.end)}
          </span>
        )}
      </div>

      {/* Sección 1 — Filtros */}
      <FiltrosPanel onApply={fetch} loading={loading} />

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Estado inicial */}
      {!hasData && !loading && !error && (
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-600 text-sm">Selecciona un período y presiona Aplicar.</p>
        </div>
      )}

      {/* Datos */}
      {hasData && !loading && (
        <>
          {/* Sección 2 — Resumen */}
          <ResumenPanel resumen={resumen} />

          {/* Sección 3 — Tablas */}
          <div className="space-y-4">

            {/* Ingresos por día */}
            <ReportTable
              title="Ingresos por día"
              empty="Sin datos en el período seleccionado."
              headers={[
                { label: 'Fecha',         key: 'fechaFmt',  right: false, color: 'text-white' },
                { label: 'Mesas',         key: 'mesas',     right: true,  color: 'text-gray-300' },
                { label: 'Total',         key: 'totalFmt',  right: true,  color: 'text-green-400' },
              ]}
              rows={porDia.map(r => ({
                fechaFmt: fmtFecha(r.fecha + 'T12:00:00'),
                mesas:    r.mesas,
                totalFmt: fmt(r.total),
              }))}
            />

            {/* Mesas más usadas */}
            <ReportTable
              title="Mesas más usadas"
              empty="Sin datos en el período seleccionado."
              headers={[
                { label: 'Mesa',     key: 'mesa',       right: false, color: 'text-white' },
                { label: 'Sesiones', key: 'sesiones',   right: true,  color: 'text-gray-300' },
                { label: 'Total',    key: 'totalFmt',   right: true,  color: 'text-green-400' },
              ]}
              rows={mesasUsadas.map(r => ({
                mesa:     r.mesa,
                sesiones: r.sesiones,
                totalFmt: fmt(r.total),
              }))}
            />

            {/* Productos más vendidos */}
            <ReportTable
              title="Productos más vendidos"
              empty="Sin consumos en el período seleccionado."
              headers={[
                { label: 'Producto',  key: 'producto',  right: false, color: 'text-white' },
                { label: 'Cantidad',  key: 'cantidad',  right: true,  color: 'text-gray-300' },
                { label: 'Total',     key: 'totalFmt',  right: true,  color: 'text-amber-400' },
              ]}
              rows={productos.map(r => ({
                producto: r.producto,
                cantidad: r.cantidad,
                totalFmt: fmt(r.total),
              }))}
            />

          </div>
        </>
      )}

    </div>
  )
}
