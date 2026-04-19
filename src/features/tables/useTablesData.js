import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

function mapProduct(row) {
  return {
    id:      row.id,
    code:    row.codigo,
    name:    row.nombre,
    price:   Number(row.precio),
    taxRate: Number(row.tax_rate),
  }
}

function mapConsumoLine(row) {
  return {
    consumoId:  row.id,
    productoId: row.producto_id,
    code:       row.productos.codigo,
    name:       row.productos.nombre,
    price:      Number(row.precio_unit),
    taxRate:    Number(row.productos.tax_rate),
    qty:        row.cantidad,
    iva:        row.cantidad * Number(row.precio_unit) * Number(row.productos.tax_rate),
    valorTotal: Number(row.subtotal),
  }
}

export function useTablesData() {
  const [tables,   setTables]   = useState([])
  const [products, setProducts] = useState([])
  const [cuentas,  setCuentas]  = useState({})
  const [salonId,  setSalonId]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const salonSeleccionado = useAuthStore(s => s.salonSeleccionado)

  useEffect(() => {
    if (!salonSeleccionado?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const salonId = salonSeleccionado.id

        // 1. Load mesas and productos in parallel
        const [mesasRes, prodRes] = await Promise.all([
          supabase
            .from('mesas')
            .select('id, numero, nombre, estado')
            .eq('salon_id', salonId)
            .order('numero'),
          supabase
            .from('productos')
            .select('id, codigo, nombre, precio, tax_rate')
            .eq('salon_id', salonId)
            .eq('activo', true)
            .order('codigo'),
        ])

        if (mesasRes.error) throw mesasRes.error
        if (prodRes.error)  throw prodRes.error

        const mesas = mesasRes.data

        // 3. Load open sesiones for these mesas
        const mesaIds = mesas.map(m => m.id)
        const { data: sesiones, error: sesErr } = await supabase
          .from('sesiones')
          .select('id, mesa_id, inicio')
          .in('mesa_id', mesaIds)
          .eq('estado', 'abierta')

        if (sesErr) throw sesErr

        // 4. Load consumos for open sesiones
        const sesionIds = (sesiones ?? []).map(s => s.id)
        let consumosByMesa = {}

        if (sesionIds.length > 0) {
          const { data: consumos, error: consumosErr } = await supabase
            .from('consumos')
            .select('id, sesion_id, producto_id, cantidad, precio_unit, subtotal, productos(codigo, nombre, tax_rate)')
            .in('sesion_id', sesionIds)

          if (consumosErr) throw consumosErr

          // Build sesion_id → mesa_id lookup
          const mesaBySesion = {}
          for (const s of sesiones) mesaBySesion[s.id] = s.mesa_id

          for (const row of consumos ?? []) {
            const mesaId = mesaBySesion[row.sesion_id]
            if (!mesaId) continue
            if (!consumosByMesa[mesaId]) consumosByMesa[mesaId] = []
            consumosByMesa[mesaId].push(mapConsumoLine(row))
          }
        }

        // 5. Build mesa lookup: mesa_id → sesion
        const sesionByMesa = {}
        for (const s of sesiones ?? []) sesionByMesa[s.mesa_id] = s

        // 6. Merge into table rows
        const mapped = mesas.map(m => {
          const sesion = sesionByMesa[m.id] ?? null
          return {
            id:        m.id,
            name:      m.nombre,
            status:    m.estado === 'activa' ? 'active' : 'closed',
            startTime: sesion ? Date.parse(sesion.inicio) : null,
            sessionId: sesion?.id ?? null,
          }
        })

        if (!cancelled) {
          setSalonId(salonId)
          setTables(mapped)
          setProducts(prodRes.data.map(mapProduct))
          setCuentas(consumosByMesa)
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Error cargando datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [salonSeleccionado?.id])

  // ── Abrir mesa ────────────────────────────────────────────────────────────
  async function openTable(id) {
    const { data: sesionData, error: sesionErr } = await supabase
      .from('sesiones')
      .insert({ mesa_id: id, estado: 'abierta' })
      .select('id, inicio')
      .single()

    if (sesionErr) {
      console.error('[openTable] insert sesion:', sesionErr)
      return sesionErr.message
    }
    if (!sesionData) {
      const msg = '[openTable] insert sesion: no data returned (check RLS / grants)'
      console.error(msg)
      return msg
    }

    const { error: mesaErr } = await supabase
      .from('mesas')
      .update({ estado: 'activa' })
      .eq('id', id)

    if (mesaErr) {
      console.error('[openTable] update mesa:', mesaErr)
      await supabase
        .from('sesiones')
        .update({ fin: new Date().toISOString(), estado: 'cerrada' })
        .eq('id', sesionData.id)
      return mesaErr.message
    }

    setTables(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: 'active', startTime: Date.parse(sesionData.inicio), sessionId: sesionData.id }
          : t
      )
    )
    setCuentas(prev => ({ ...prev, [id]: [] }))
  }

  // ── Cerrar mesa ───────────────────────────────────────────────────────────
  async function closeTable(id) {
    // Read needed values from current state
    let sessionId = null
    let startTime = null
    setTables(prev => {
      const t = prev.find(t => t.id === id)
      sessionId = t?.sessionId ?? null
      startTime = t?.startTime ?? null
      return prev
    })
    await Promise.resolve()

    const now = Date.now()

    // 1. Fetch active tarifa — non-blocking: default to 0 if missing or error
    let PRECIO_HORA = 0
    if (salonId) {
      const { data: tarifaData } = await supabase
        .from('tarifas')
        .select('precio_hora')
        .eq('salon_id', salonId)
        .eq('activo', true)
        .limit(1)
        .maybeSingle()
      if (tarifaData?.precio_hora != null) PRECIO_HORA = Number(tarifaData.precio_hora)
    }

    // 2. Calculate factura values
    const tiempo_total  = Math.floor((now - (startTime ?? now)) / 60000)
    const valor_tiempo  = (tiempo_total / 60) * PRECIO_HORA
    const lines         = cuentas[id] ?? []
    const valor_consumo = lines.reduce((sum, l) => sum + l.valorTotal, 0)
    const total         = valor_tiempo + valor_consumo

    // 2. INSERT factura
    const { error: facturaErr } = await supabase
      .from('facturas')
      .insert({
        sesion_id:      sessionId,
        tiempo_total,
        valor_tiempo,
        valor_consumo,
        total,
      })

    if (facturaErr) {
      console.error('[closeTable] insert factura:', facturaErr)
      return facturaErr.message
    }

    // 3. UPDATE sesion → 'facturada'
    const fin = new Date(now).toISOString()
    if (sessionId) {
      const { error: sesionErr } = await supabase
        .from('sesiones')
        .update({ fin, estado: 'facturada' })
        .eq('id', sessionId)

      if (sesionErr) {
        console.error('[closeTable] update sesion:', sesionErr)
        return sesionErr.message
      }
    }

    // 4. UPDATE mesa → 'cerrada'
    const { error: mesaErr } = await supabase
      .from('mesas')
      .update({ estado: 'cerrada' })
      .eq('id', id)

    if (mesaErr) {
      console.error('[closeTable] update mesa:', mesaErr)
      return mesaErr.message
    }

    // 5. Clear local state
    setTables(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: 'closed', startTime: null, sessionId: null }
          : t
      )
    )
    setCuentas(prev => ({ ...prev, [id]: [] }))
  }

  // ── Agregar producto a cuenta ─────────────────────────────────────────────
  async function addProduct(tableId, product) {
    const sessionId = tables.find(t => t.id === tableId)?.sessionId
    if (!sessionId) return 'Mesa sin sesión activa'

    const lines      = cuentas[tableId] ?? []
    const existing   = lines.find(l => l.productoId === product.id)

    if (existing) {
      // UPDATE existing consumo
      const newQty      = existing.qty + 1
      const newSubtotal = newQty * existing.price * (1 + existing.taxRate)
      const newIva      = newQty * existing.price * existing.taxRate

      const { error } = await supabase
        .from('consumos')
        .update({ cantidad: newQty, subtotal: newSubtotal })
        .eq('id', existing.consumoId)

      if (error) {
        console.error('[addProduct] update consumo:', error)
        return error.message
      }

      setCuentas(prev => ({
        ...prev,
        [tableId]: prev[tableId].map(l =>
          l.consumoId === existing.consumoId
            ? { ...l, qty: newQty, iva: newIva, valorTotal: newSubtotal }
            : l
        ),
      }))
    } else {
      // INSERT new consumo
      const subtotal = product.price * (1 + product.taxRate)

      const { data, error } = await supabase
        .from('consumos')
        .insert({
          sesion_id:  sessionId,
          producto_id: product.id,
          cantidad:   1,
          precio_unit: product.price,
          subtotal,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[addProduct] insert consumo:', error)
        return error.message
      }

      const newLine = {
        consumoId:  data.id,
        productoId: product.id,
        code:       product.code,
        name:       product.name,
        price:      product.price,
        taxRate:    product.taxRate,
        qty:        1,
        iva:        product.price * product.taxRate,
        valorTotal: subtotal,
      }

      setCuentas(prev => ({
        ...prev,
        [tableId]: [...(prev[tableId] ?? []), newLine],
      }))
    }
  }

  // ── Eliminar línea de cuenta ──────────────────────────────────────────────
  async function deleteLine(tableId, consumoId) {
    const { error } = await supabase
      .from('consumos')
      .delete()
      .eq('id', consumoId)

    if (error) {
      console.error('[deleteLine] delete consumo:', error)
      return error.message
    }

    setCuentas(prev => ({
      ...prev,
      [tableId]: prev[tableId].filter(l => l.consumoId !== consumoId),
    }))
  }

  return { tables, setTables, products, cuentas, loading, error, openTable, closeTable, addProduct, deleteLine }
}
