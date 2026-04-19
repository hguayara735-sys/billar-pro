import { useState, useEffect, useRef } from 'react'
import { RotateCcw, Bell, CreditCard, RefreshCw, X, ListRestart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// ─── Player color themes ─────────────────────────────────────────────────────

const THEMES = [
  { label: 'Jugador 1', text: 'text-slate-200',  border: 'border-slate-500',  btn: 'bg-slate-700/60  text-slate-200  border-slate-600' },
  { label: 'Jugador 2', text: 'text-yellow-400', border: 'border-yellow-500', btn: 'bg-yellow-900/40 text-yellow-300 border-yellow-700' },
  { label: 'Jugador 3', text: 'text-red-400',    border: 'border-red-500',    btn: 'bg-red-900/40    text-red-300    border-red-700' },
  { label: 'Jugador 4', text: 'text-blue-400',   border: 'border-blue-500',   btn: 'bg-blue-900/40   text-blue-300   border-blue-700' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
  } catch (_) {}
}

function useElapsed(startTime) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])
  return elapsed
}

// ─── Card sizes ───────────────────────────────────────────────────────────────

const SZ = {
  lg: { score: 'text-[7rem]', btn: 'px-3 py-1.5 text-sm', gap: 'gap-4', pad: 'p-6' },
  md: { score: 'text-7xl',   btn: 'px-2.5 py-1 text-sm',  gap: 'gap-3', pad: 'p-4' },
  sm: { score: 'text-5xl',   btn: 'px-2 py-1 text-xs',    gap: 'gap-2', pad: 'p-3' },
}

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({ player, theme, size = 'md', onScore, onName }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const inputRef = useRef(null)
  const sz = SZ[size]

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function startEdit() { setDraft(player.name); setEditing(true) }
  function confirmEdit() { onName(player.id, draft.trim() || player.name); setEditing(false) }

  return (
    <div className={`flex flex-col items-center justify-center ${sz.pad} ${sz.gap} rounded-2xl bg-gray-900 border-2 ${theme.border} h-full`}>

      {/* Editable name */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={e => e.key === 'Enter' && confirmEdit()}
          className="bg-gray-800 text-white text-center font-bold rounded-lg px-3 py-1 text-sm w-36
            outline-none border border-gray-600 focus:border-indigo-500"
        />
      ) : (
        <span
          onClick={startEdit}
          className={`${theme.text} font-bold text-sm cursor-pointer hover:underline underline-offset-2 select-none`}
          title="Click para editar nombre"
        >
          {player.name}
        </span>
      )}

      {/* Score — click = +1 */}
      <div
        onClick={() => onScore(player.id, player.score + 1)}
        className={`${sz.score} font-black text-white cursor-pointer select-none leading-none
          hover:scale-105 active:scale-95 transition-transform`}
        title="Click para +1"
      >
        {player.score}
      </div>

      {/* Point buttons */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        <button
          onClick={() => onScore(player.id, Math.max(0, player.score - 1))}
          className={`${sz.btn} rounded-lg bg-red-900/40 text-red-400 border border-red-700
            hover:bg-red-900/60 font-medium transition-colors`}
        >
          -1
        </button>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onScore(player.id, player.score + n)}
            className={`${sz.btn} rounded-lg ${theme.btn} border hover:opacity-80 font-medium transition-opacity`}
          >
            +{n}
          </button>
        ))}
      </div>

      {/* Reset this player */}
      <button
        onClick={() => onScore(player.id, 0)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        <RotateCcw size={11} /> Reiniciar
      </button>
    </div>
  )
}

// ─── Time & consumption panel ─────────────────────────────────────────────────

function TimePanel({ elapsed, children }) {
  const rows = [
    { label: 'Tiempo en juego', value: fmtTime(elapsed), color: 'text-green-400' },
    { label: 'Tiempo total',    value: fmtTime(elapsed), color: 'text-green-400' },
    { label: 'Valor tiempo',    value: '$0',             color: 'text-gray-400'  },
    { label: 'Valor consumo',   value: '$0',             color: 'text-gray-400'  },
  ]

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-2xl p-4 gap-3 h-full">
      <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest shrink-0">
        Tiempo y Consumo
      </h3>

      <div className="flex-1 space-y-2">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-xs text-gray-500">{label}</span>
            <span className={`text-sm font-mono ${color}`}>{value}</span>
          </div>
        ))}
        <div className="border-t border-gray-700 pt-2 flex justify-between items-center">
          <span className="text-sm font-bold text-white">TOTAL</span>
          <span className="text-sm font-mono font-bold text-green-400">$0</span>
        </div>
      </div>

      {/* Global buttons slot */}
      <div className="mt-auto shrink-0 flex flex-col gap-2">
        {children}
      </div>
    </div>
  )
}

// ─── Global action buttons ────────────────────────────────────────────────────

function GlobalButtons({ onNewGame, onResetScores, onBell, onPay, activeMesas, selectedMesaId, onSelectMesa, bellSending }) {
  const showBell = activeMesas.length > 0

  return (
    <>
      {/* Mesa selector — solo si hay mesas activas */}
      {showBell && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Mesa activa</label>
          <select
            value={selectedMesaId}
            onChange={e => onSelectMesa(e.target.value)}
            className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700
              w-full focus:outline-none focus:border-indigo-500"
          >
            <option value="">Seleccionar mesa...</option>
            {activeMesas.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={onNewGame}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg
          bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 transition-colors"
      >
        <RefreshCw size={14} /> Nuevo juego
      </button>
      <button
        onClick={onResetScores}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg
          bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 text-sm font-medium
          hover:bg-indigo-600/30 transition-colors"
      >
        <ListRestart size={14} /> Reiniciar marcadores
      </button>

      {/* Campana — solo aparece si hay mesas activas Y una está seleccionada */}
      {showBell && selectedMesaId && (
        <button
          onClick={onBell}
          disabled={bellSending}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg
            bg-amber-600/20 text-amber-400 border border-amber-600/30 text-sm font-medium
            hover:bg-amber-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bell size={14} /> {bellSending ? 'Enviando...' : 'Campana'}
        </button>
      )}

      <button
        onClick={onPay}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg
          bg-green-600/20 text-green-400 border border-green-600/30 text-sm font-medium
          hover:bg-green-600/30 transition-colors"
      >
        <CreditCard size={14} /> Pago
      </button>
    </>
  )
}

// ─── Payment summary modal ────────────────────────────────────────────────────

function PayModal({ players, elapsed, playerCount, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold">Resumen de Cuenta</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Player scores */}
        <div className="space-y-2">
          {players.slice(0, playerCount).map((p, i) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className={`${THEMES[i].text} font-medium`}>{p.name}</span>
              <span className="text-white font-mono font-bold">{p.score} pts</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-700 pt-3 space-y-1.5">
          {[
            ['Tiempo en juego', fmtTime(elapsed)],
            ['Valor tiempo',    '$0'],
            ['Valor consumo',   '$0'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-xs text-gray-500">
              <span>{label}</span>
              <span className="font-mono">{val}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-gray-700">
            <span>TOTAL</span>
            <span className="font-mono text-green-400">$0</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
            hover:bg-indigo-500 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const [playerCount, setPlayerCount] = useState(2)
  const [players, setPlayers] = useState(
    THEMES.map((t, i) => ({ id: i + 1, name: t.label, score: 0 }))
  )
  const [gameStart, setGameStart] = useState(() => Date.now())
  const [showPay,   setShowPay]   = useState(false)
  const elapsed = useElapsed(gameStart)

  // ── Mesa selector state ──────────────────────────────────────────────────
  const [activeMesas,    setActiveMesas]    = useState([])
  const [salonId,        setSalonId]        = useState(null)
  const [selectedMesaId, setSelectedMesaId] = useState('')
  const [bellSending,    setBellSending]    = useState(false)
  const salonSeleccionado = useAuthStore(s => s.salonSeleccionado)

  useEffect(() => {
    if (!salonSeleccionado?.id) return
    const sid = salonSeleccionado.id
    setSalonId(sid)

    async function loadMesas() {
      const { data: mesas } = await supabase
        .from('mesas')
        .select('id, nombre')
        .eq('salon_id', sid)
        .eq('estado', 'activa')
        .order('numero')

      const list = mesas ?? []
      setActiveMesas(list)

      // Clear selection if selected mesa is no longer active
      setSelectedMesaId(prev => {
        if (!prev) return prev
        return list.find(m => m.id === prev) ? prev : ''
      })
    }

    loadMesas()

    // Suscripción para mantener la lista fresca cuando cambia el estado de las mesas
    const channel = supabase
      .channel('scoring-mesas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, loadMesas)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [salonSeleccionado?.id])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function setScore(id, score) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, score: Math.max(0, score) } : p))
  }

  function setName(id, name) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }

  function newGame() {
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })))
    setGameStart(Date.now())
  }

  function resetScores() {
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })))
  }

  function changeCount(n) {
    setPlayerCount(n)
    newGame()
  }

  async function handleBell() {
    playBell()
    if (!selectedMesaId || !salonId) return

    setBellSending(true)
    const { error } = await supabase.from('alertas').insert({
      mesa_id:  selectedMesaId,
      salon_id: salonId,
      tipo:     'campana',
    })
    if (error) console.error('[handleBell] insert alerta:', error.message)
    setBellSending(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const visible = players.slice(0, playerCount)

  const panel = (
    <TimePanel elapsed={elapsed}>
      <GlobalButtons
        onNewGame={newGame}
        onResetScores={resetScores}
        onBell={handleBell}
        onPay={() => setShowPay(true)}
        activeMesas={activeMesas}
        selectedMesaId={selectedMesaId}
        onSelectMesa={setSelectedMesaId}
        bellSending={bellSending}
      />
    </TimePanel>
  )

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">

      {/* Header — title + player count selector */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-white font-bold text-sm uppercase tracking-widest">Marcador</h1>
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => changeCount(n)}
              className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-colors
                ${playerCount === n ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2 jugadores: tarjetas lado a lado + panel derecho ── */}
      {playerCount === 2 && (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {visible.map((p, i) => (
            <div key={p.id} className="flex-1">
              <PlayerCard player={p} theme={THEMES[i]} size="lg" onScore={setScore} onName={setName} />
            </div>
          ))}
          <div className="w-52 shrink-0">{panel}</div>
        </div>
      )}

      {/* ── 3 jugadores: grid 2×2, cuadrante 4 = panel ── */}
      {playerCount === 3 && (
        <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 overflow-hidden">
          {visible.map((p, i) => (
            <PlayerCard key={p.id} player={p} theme={THEMES[i]} size="md" onScore={setScore} onName={setName} />
          ))}
          {panel}
        </div>
      )}

      {/* ── 4 jugadores: columna vertical + panel derecho ── */}
      {playerCount === 4 && (
        <div className="flex flex-1 gap-4 overflow-hidden">
          <div className="flex-1 flex flex-col gap-3">
            {visible.map((p, i) => (
              <div key={p.id} className="flex-1">
                <PlayerCard player={p} theme={THEMES[i]} size="sm" onScore={setScore} onName={setName} />
              </div>
            ))}
          </div>
          <div className="w-52 shrink-0">{panel}</div>
        </div>
      )}

      {showPay && (
        <PayModal
          players={players}
          elapsed={elapsed}
          playerCount={playerCount}
          onClose={() => setShowPay(false)}
        />
      )}
    </div>
  )
}
