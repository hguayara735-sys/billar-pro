import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/layout/Sidebar'
import InicioPage from '../features/dashboard/InicioPage'
import TablesPage from '../features/tables/TablesPage'
import ScoringPage from '../features/scoring/ScoringPage'
import ConfiguracionPage from '../features/admin/ConfiguracionPage'
import ProductosPage from '../features/products/ProductosPage'
import CajaPage from '../features/cash/CajaPage'
import ReportesPage from '../features/reports/ReportesPage'
import UsuariosPage from '../features/users/UsuariosPage'

const SECTION_LABELS = {
  inicio:        'Inicio',
  mesas:         'Mesas',
  marcador:      'Marcador',
  productos:     'Productos',
  caja:          'Caja',
  reportes:      'Reportes',
  configuracion: 'Configuración',
  usuarios:      'Usuarios',
}

function SectionPlaceholder({ label }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">Sección activa</p>
        <h1 className="text-4xl font-bold text-white">{label}</h1>
      </div>
    </div>
  )
}

const ADMIN_SECTIONS = ['reportes', 'configuracion', 'usuarios']

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState('inicio')
  const { rol } = useAuth()

  function renderContent() {
    if (rol === 'operador' && ADMIN_SECTIONS.includes(activeSection)) {
      return <InicioPage />
    }
    switch (activeSection) {
      case 'inicio':         return <InicioPage />
      case 'mesas':          return <TablesPage />
      case 'marcador':       return <ScoringPage />
      case 'configuracion':  return <ConfiguracionPage />
      case 'productos':      return <ProductosPage />
      case 'caja':           return <CajaPage />
      case 'reportes':       return <ReportesPage />
      case 'usuarios':       return <UsuariosPage />
      default:               return <SectionPlaceholder label={SECTION_LABELS[activeSection]} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} rol={rol} />
      <main className="flex-1 overflow-hidden flex">
        {renderContent()}
      </main>
    </div>
  )
}
