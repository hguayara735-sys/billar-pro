import { Home, CircleDot, Trophy, Package, DollarSign, BarChart2, Settings, Users } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'inicio',         label: 'Inicio',         icon: Home },
  { id: 'mesas',          label: 'Mesas',          icon: CircleDot },
  { id: 'marcador',       label: 'Marcador',       icon: Trophy },
  { id: 'productos',      label: 'Productos',      icon: Package },
  { id: 'caja',           label: 'Caja',           icon: DollarSign },
  { id: 'reportes',       label: 'Reportes',       icon: BarChart2,  adminOnly: true },
  { id: 'configuracion',  label: 'Configuración',  icon: Settings,   adminOnly: true },
  { id: 'usuarios',       label: 'Usuarios',       icon: Users,      adminOnly: true },
]

export default function Sidebar({ activeSection, onNavigate, rol }) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-gray-950 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <CircleDot className="text-indigo-400" size={22} />
        <span className="text-white font-bold text-lg tracking-tight">Billar Pro</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.filter(item => !item.adminOnly || rol === 'admin').map(({ id, label, icon: Icon }) => {
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
    </aside>
  )
}
