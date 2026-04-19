import { useState, useEffect, useRef } from 'react'
import { Home, CircleDot, Trophy, Package, DollarSign, BarChart2, Settings, Users, Building2, ChevronDown, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { id: 'inicio',         label: 'Inicio',         icon: Home },
  { id: 'salones',        label: 'Salones',        icon: Building2,  adminOnly: true },
  { id: 'mesas',          label: 'Mesas',          icon: CircleDot },
  { id: 'marcador',       label: 'Marcador',       icon: Trophy },
  { id: 'productos',      label: 'Productos',      icon: Package },
  { id: 'caja',           label: 'Caja',           icon: DollarSign },
  { id: 'reportes',       label: 'Reportes',       icon: BarChart2,  adminOnly: true },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings,   adminOnly: true },
  { id: 'usuarios',       label: 'Usuarios',       icon: Users,      adminOnly: true },
]

function SalonSelector({ rol }) {
  const [salones, setSalones]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [open, setOpen]             = useState(false)
  const ref                         = useRef(null)
  const setSalonSeleccionado        = useAuthStore(s => s.setSalonSeleccionado)

  useEffect(() => {
    if (rol !== 'admin' && rol !== 'superadmin') return
    supabase.from('salones').select('id, nombre').order('nombre').then(({ data }) => {
      if (data?.length) {
        setSalones(data)
        setSelected(data[0])
        setSalonSeleccionado(data[0])
      }
    })
  }, [rol])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (rol !== 'admin' && rol !== 'superadmin') return null

  return (
    <div ref={ref} className="relative px-3 py-3 border-b border-gray-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg
          bg-gray-900 border border-gray-700 hover:border-indigo-500 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="text-indigo-400 shrink-0" />
          <span className="text-sm text-white truncate">
            {selected ? selected.nombre : 'Seleccionar salón'}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-gray-900 border border-gray-700
          rounded-lg shadow-lg overflow-hidden">
          {salones.map(salon => (
            <button
              key={salon.id}
              onClick={() => { setSelected(salon); setSalonSeleccionado(salon); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm
                hover:bg-gray-800 transition-colors"
            >
              <span className={selected?.id === salon.id ? 'text-indigo-400' : 'text-gray-300'}>
                {salon.nombre}
              </span>
              {selected?.id === salon.id && <Check size={13} className="text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ activeSection, onNavigate, rol }) {
  return (
    <aside className="relative flex flex-col w-56 min-h-screen bg-gray-950 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <CircleDot className="text-indigo-400" size={22} />
        <span className="text-white font-bold text-lg tracking-tight">Billar Pro</span>
      </div>

      {/* Selector de salón */}
      <SalonSelector rol={rol} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.filter(item => !item.adminOnly || rol === 'admin' || rol === 'superadmin').map(({ id, label, icon: Icon }) => {
          const active = activeSection === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        })}
      </nav>

      <img
        src="/firma.png"
        alt=""
        style={{
          display: 'block',
          width: '220px',
          opacity: 0.9,
          transform: 'rotate(-15deg)',
          margin: '0 auto',
          marginTop: '24px',
          pointerEvents: 'none',
          filter: 'brightness(0) invert(1)',
        }}
      />
    </aside>
  )
}
