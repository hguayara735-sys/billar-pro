import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const SALON_NAME = 'Billar Tito'

export function useDashboardData() {
  const [tables,   setTables]   = useState([])
  const [alertas,  setAlertas]  = useState([])
  const [summary,  setSummary]  = useState({ ingresosHoy: 0, mesasActivas: 0, mesasAtendidasHoy: 0, consumosHoy: 0 })
  const [salonId,  setSalonId]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const salonIdRef = useRef(null)

  const loadData = useCallback(async () => {
    const sid = salonIdRef.current
    if (!sid) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // 1. Mesas del salón
    const { data: mesas, error: mesasErr } = await supabase
      .from('mesas')
      .select('id, nombre, estado')
      .eq('salon_id', sid)
      .order('numero')

    if (mesasErr) { setError(mesasErr.message); return }

    const mesaIds = mesas.map(m => m.id)

    // 2. Sesiones abiertas + sesiones facturadas hoy + alertas pendientes — en paralelo
    const [sesionesRes, hoyRes, alertasRes] = await Promise.all([
      supabase
        .from('sesiones')
        .select('id, mesa_id, inicio')
        .in('mesa_id', mesaIds)
        .eq('estado', 'abierta'),
      supabase
        .from('sesiones')
        .select('id')
        .in('mesa_id', mesaIds)
        .eq('estado', 'facturada')
        .gte('fin', todayStart.toISOString()),
      supabase
        .from('alertas')
        .select('id, mesa_id, tipo, estado, created_at, mesas(nombre)')
        .eq('salon_id', sid)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
    ])

    if (sesionesRes.error) { setError(sesionesRes.error.message); return }
    if (hoyRes.error)      { setError(hoyRes.error.message);      return }
    if (alertasRes.error)  { setError(alertasRes.error.message);  return }

    const sesiones   = sesionesRes.data ?? []
    const hoySession = hoyRes.data ?? []

    // 3. Facturas del día
    let ingresosHoy = 0
    let consumosHoy = 0

    if (hoySession.length) {
      const { data: facturas, error: factErr } = await supabase
        .from('facturas')
        .select('total, valor_consumo')
        .in('sesion_id', hoySession.map(s => s.id))

      if (factErr) { setError(factErr.message); return }

      for (const f of facturas ?? []) {
        ingresosHoy += Number(f.total)
        consumosHoy += Number(f.valor_consumo)
      }
    }

    // 4. Armar tablas con startTime
    const sesionByMesa = {}
    for (const s of sesiones) sesionByMesa[s.mesa_id] = s

    const mappedTables = mesas.map(m => ({
      id:        m.id,
      name:      m.nombre,
      status:    m.estado === 'activa' ? 'active' : 'closed',
      startTime: sesionByMesa[m.id] ? Date.parse(sesionByMesa[m.id].inicio) : null,
    }))

    // 5. Armar alertas
    const mappedAlertas = (alertasRes.data ?? []).map(a => ({
      id:         a.id,
      mesaId:     a.mesa_id,
      mesaNombre: a.mesas?.nombre ?? 'Mesa',
      tipo:       a.tipo,
      createdAt:  a.created_at,
    }))

    setTables(mappedTables)
    setAlertas(mappedAlertas)
    setSummary({
      ingresosHoy,
      mesasActivas:      mappedTables.filter(t => t.status === 'active').length,
      mesasAtendidasHoy: hoySession.length,
      consumosHoy,
    })
  }, [])

  // Carga inicial — resuelve salon_id y luego carga datos
  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      setError(null)

      const { data: salons, error: salonErr } = await supabase
        .from('salones')
        .select('id')
        .eq('nombre', SALON_NAME)
        .limit(1)

      if (cancelled) return

      if (salonErr || !salons?.length) {
        setError(salonErr?.message ?? `Salón "${SALON_NAME}" no encontrado`)
        setLoading(false)
        return
      }

      salonIdRef.current = salons[0].id
      setSalonId(salons[0].id)
      await loadData()
      if (!cancelled) setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [loadData])

  // Realtime — escucha cambios en mesas, sesiones, facturas y alertas
  useEffect(() => {
    if (!salonId) return

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'mesas'    }, loadData)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'sesiones' }, loadData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'facturas' }, loadData)
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'alertas'  }, loadData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [salonId, loadData])

  // Marcar alerta como atendida — actualiza local de inmediato, realtime confirma
  async function markAtendida(alertaId) {
    setAlertas(prev => prev.filter(a => a.id !== alertaId))
    const { error } = await supabase
      .from('alertas')
      .update({ estado: 'atendida' })
      .eq('id', alertaId)
    if (error) console.error('[markAtendida]', error.message)
  }

  return { tables, alertas, summary, loading, error, markAtendida }
}
