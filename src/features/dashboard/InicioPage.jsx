import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle, Clock, DollarSign, Users, Activity, Bell, X } from 'lucide-react'
import { useDashboardData } from './useDashboardData'

const THREE_HOURS = 3 * 60 * 60 * 1000

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style:                 'currency',
    currency:              'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function playBell() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch (_) {}
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon size={15} className={color} />
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <span className="text-white font-bold text-xl tabular-nums leading-none">{value}</span>
    </div>
  )
}

// ─── Toast de nueva alerta ────────────────────────────────────────────────────

function BellToast({ alerta, onClose }) {
  if (!alerta) return null
  const label = alerta.tipo === 'campana' ? 'Campana' : 'Pedir cuenta'
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-start gap-3
      bg-amber-950 border border-amber-600 rounded-xl px-4 py-3 shadow-2xl max-w-xs">
      <Bell size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-200 text-sm font-bold">{label}</p>
        <p className="text-amber-400 text-xs truncate">{alerta.mesaNombre}</p>
      </div>
      <button
        onClick={onClose}
        className="text-amber-600 hover:text-amber-300 transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InicioPage() {
  const { tables, alertas, summary, loading, error, markAtendida } = useDashboardData()
  const [now,   setNow]   = useState(() => Date.now())
  const [toast, setToast] = useState(null)

  // Reloj que ticks cada segundo para los timers locales
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Detectar alertas nuevas (excluye la carga inicial)
  const initializedRef  = useRef(false)
  const knownIdsRef     = useRef(new Set())
  const toastTimerRef   = useRef(null)

  useEffect(() => {
    if (loading) return

    if (!initializedRef.current) {
      // Primer render con datos: registrar IDs existentes sin notificar
      initializedRef.current = true
      knownIdsRef.current = new Set(alertas.map(a => a.id))
      return
    }

    const newOnes = alertas.filter(a => !knownIdsRef.current.has(a.id))
    knownIdsRef.current = new Set(alertas.map(a => a.id))

    if (newOnes.length > 0) {
      playBell()
      clearTimeout(toastTimerRef.current)
      setToast(newOnes[0])
      toastTimerRef.current = setTimeout(() => setToast(null), 4000)
    }
  }, [alertas, loading])

  // Limpiar timer del toast al desmontar
  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  // Alertas de tiempo (> 3h en mesa activa)
  const timerAlerts = tables.filter(
    t => t.status === 'active' && t.startTime != null && (now - t.startTime) > THREE_HOURS
  )

  const hasAlerts = timerAlerts.length > 0 || alertas.length > 0

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-gray-400 text-sm">Cargando dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <span className="text-red-400 text-sm text-center">{error}</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Sección 1: Estado de mesas en tiempo real ── */}
        <section>
          <h2 className="text-white font-semibold text-sm uppercase tracking-widest mb-3">
            Estado de mesas
          </h2>
          {tables.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay mesas registradas.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {tables.map(table => {
                const active  = table.status === 'active'
                const elapsed = active && table.startTime != null ? now - table.startTime : 0
                return (
                  <div
                    key={table.id}
                    className={`rounded-xl p-3 flex flex-col items-center gap-1.5 select-none
                      ${active
                        ? 'bg-emerald-950 border border-emerald-700'
                        : 'bg-gray-800  border border-gray-700'
                      }`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wide truncate w-full text-center
                      ${active ? 'text-emerald-300' : 'text-gray-500'}`}>
                      {table.name}
                    </span>
                    {active ? (
                      <span className="text-emerald-400 text-xs font-mono tabular-nums">
                        {formatElapsed(elapsed)}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">Cerrada</span>
                    )}
                    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Sección 2: Resumen del día ── */}
        <section>
          <h2 className="text-white font-semibold text-sm uppercase tracking-widest mb-3">
            Resumen del día
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Ingresos hoy"       value={formatCurrency(summary.ingresosHoy)}    color="text-indigo-400" />
            <StatCard icon={Activity}   label="Mesas activas ahora" value={summary.mesasActivas}                  color="text-emerald-400" />
            <StatCard icon={Users}      label="Mesas atendidas hoy" value={summary.mesasAtendidasHoy}             color="text-sky-400" />
            <StatCard icon={Clock}      label="Consumos del día"    value={formatCurrency(summary.consumosHoy)}   color="text-amber-400" />
          </div>
        </section>

        {/* ── Sección 3: Alertas ── */}
        <section>
          <h2 className="text-white font-semibold text-sm uppercase tracking-widest mb-3">
            Alertas
          </h2>

          {!hasAlerts ? (
            <div className="flex items-center gap-2.5 bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300 text-sm font-medium">Todo en orden</span>
            </div>
          ) : (
            <div className="space-y-2">

              {/* Alertas de campana / cuenta desde BD */}
              {alertas.map(alerta => (
                <div
                  key={alerta.id}
                  className="flex items-center gap-3 bg-amber-950 border border-amber-700 rounded-xl px-4 py-3"
                >
                  <Bell size={16} className="text-amber-400 flex-shrink-0" />
                  <span className="text-amber-200 text-sm flex-1">
                    <span className="font-semibold">{alerta.mesaNombre}</span>
                    {' — '}
                    {alerta.tipo === 'campana' ? 'solicita atención' : 'pide la cuenta'}
                  </span>
                  <button
                    onClick={() => markAtendida(alerta.id)}
                    className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-200
                      border border-amber-700 hover:border-amber-500 rounded-lg px-2.5 py-1
                      transition-colors flex-shrink-0"
                  >
                    Atendida
                  </button>
                </div>
              ))}

              {/* Alertas de tiempo > 3 horas */}
              {timerAlerts.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-3"
                >
                  <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
                  <span className="text-yellow-200 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    {' lleva '}
                    <span className="font-mono tabular-nums">{formatElapsed(now - t.startTime)}</span>
                    {' activa'}
                  </span>
                </div>
              ))}

            </div>
          )}
        </section>

      </div>

      {/* Toast fijo — nueva alerta en tiempo real */}
      <BellToast alerta={toast} onClose={() => setToast(null)} />
    </>
  )
}
