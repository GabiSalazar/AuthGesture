import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Download,
  AlertCircle
} from 'lucide-react'

import UserDetailsModal from './UserDetailsModal'
import EditUserModal from './EditUserModal'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function UsersManagement() {
  // Estados principales
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Estado para dropdown personalizado
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false)
  const [sortByDropdownOpen, setSortByDropdownOpen] = useState(false)
  const [sortOrderDropdownOpen, setSortOrderDropdownOpen] = useState(false)

  // Estados de modales
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Cargar usuarios al montar el componente
  useEffect(() => {
    loadUsers()
  }, [])

  // Cargar usuarios con filtros
  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const filters = {
        search: searchTerm,
        gender: genderFilter,
        min_age: minAge,
        max_age: maxAge,
        sort_by: sortBy,
        sort_order: sortOrder
      }
      
      const response = await adminApi.getUsers(filters)
      setUsers(response.users || [])
    } catch (err) {
      console.error('Error cargando usuarios:', err)
      setError('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros
  const handleApplyFilters = () => {
    loadUsers()
  }

  // Limpiar filtros
  const handleClearFilters = () => {
    setSearchTerm('')
    setGenderFilter('')
    setMinAge('')
    setMaxAge('')
    setSortBy('created_at')
    setSortOrder('desc')
    setTimeout(loadUsers, 100)
  }

  // Abrir modal de detalles
  const handleViewUser = (user) => {
    setSelectedUser(user)
    setShowDetailsModal(true)
  }

  // Abrir modal de edición
  const handleEditUser = (user) => {
    setSelectedUser(user)
    setShowEditModal(true)
  }

  // Abrir modal de confirmación de eliminación
  const handleDeleteUser = (user) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  // Formatear fecha
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Formatear última actividad
  const formatLastActivity = (timestamp) => {
    const now = Date.now()
    const diff = now - (timestamp * 1000)
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`
    return formatDate(timestamp)
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================
          HEADER
      ======================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-600">
            Gestión de usuarios
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Administra usuarios registrados en el sistema
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          style={{
            background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
            boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
          }}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Recargar</span>
        </button>
      </div>

      {/* ========================================
          CARD DE FILTROS
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg p-6"
        style={{ borderColor: '#E0F2FE' }}
      >
        {/* Header filtros */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-5 h-5" style={{ color: '#05A8F9' }} />
            <h3 className="text-lg font-black text-gray-900">
              Filtros de búsqueda
            </h3>
          </div>
        </div>

        {/* Grid de filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Búsqueda */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Buscar
            </label>
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
                className="w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
                style={{ borderColor: '#E0F2FE' }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#05A8F9'
                  e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E0F2FE'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          {/* Filtro género */}
          {/* Filtro género - CUSTOM SELECT */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Género
            </label>
            
            <div className="relative">
              {/* Trigger del dropdown */}
              <button
                type="button"
                onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                className="w-full px-3 py-2 border-2 rounded-xl text-left transition-all font-medium text-sm bg-white flex items-center justify-between"
                style={{ borderColor: genderDropdownOpen ? '#05A8F9' : '#E0F2FE' }}
                onBlur={() => setTimeout(() => setGenderDropdownOpen(false), 200)}
              >
                <span className="text-gray-700">
                  {genderFilter === '' && 'Todos'}
                  {genderFilter === 'Masculino' && 'Masculino'}
                  {genderFilter === 'Femenino' && 'Femenino'}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${genderDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown de opciones */}
              {genderDropdownOpen && (
                <div 
                  className="absolute z-10 w-full mt-1 bg-white border-2 rounded-xl shadow-lg overflow-hidden"
                  style={{ borderColor: '#E0F2FE' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setGenderFilter('')
                      setGenderDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenderFilter('Masculino')
                      setGenderDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Masculino
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGenderFilter('Femenino')
                      setGenderDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Femenino
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edad mínima */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Edad mínima
            </label>
            <input
              type="number"
              placeholder="Ej: 18"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
              style={{ borderColor: '#E0F2FE' }}
              onFocus={(e) => {
                e.target.style.borderColor = '#05A8F9'
                e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E0F2FE'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Edad máxima */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Edad máxima
            </label>
            <input
              type="number"
              placeholder="Ej: 65"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all text-gray-900 font-medium"
              style={{ borderColor: '#E0F2FE' }}
              onFocus={(e) => {
                e.target.style.borderColor = '#05A8F9'
                e.target.style.boxShadow = '0 0 0 3px rgba(5, 168, 249, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E0F2FE'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Ordenar por */}
          {/* Ordenar por - CUSTOM DROPDOWN */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Ordenar por
            </label>
            
            <div className="relative">
              {/* Trigger del dropdown */}
              <button
                type="button"
                onClick={() => setSortByDropdownOpen(!sortByDropdownOpen)}
                className="w-full px-3 py-2 border-2 rounded-xl text-left transition-all font-medium text-sm bg-white flex items-center justify-between"
                style={{ borderColor: sortByDropdownOpen ? '#05A8F9' : '#E0F2FE' }}
                onBlur={() => setTimeout(() => setSortByDropdownOpen(false), 200)}
              >
                <span className="text-gray-700">
                  {sortBy === 'created_at' && 'Fecha de registro'}
                  {sortBy === 'username' && 'Nombre'}
                  {sortBy === 'age' && 'Edad'}
                  {sortBy === 'templates' && 'Templates'}
                  {sortBy === 'last_activity' && 'Última actividad'}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${sortByDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown de opciones */}
              {sortByDropdownOpen && (
                <div 
                  className="absolute z-10 w-full mt-1 bg-white border-2 rounded-xl shadow-lg overflow-hidden"
                  style={{ borderColor: '#E0F2FE' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('created_at')
                      setSortByDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Fecha de registro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('username')
                      setSortByDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Nombre
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('age')
                      setSortByDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Edad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('templates')
                      setSortByDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('last_activity')
                      setSortByDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Última actividad
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Orden */}
          {/* Orden - CUSTOM DROPDOWN */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              Orden
            </label>
            
            <div className="relative">
              {/* Trigger del dropdown */}
              <button
                type="button"
                onClick={() => setSortOrderDropdownOpen(!sortOrderDropdownOpen)}
                className="w-full px-3 py-2 border-2 rounded-xl text-left transition-all font-medium text-sm bg-white flex items-center justify-between"
                style={{ borderColor: sortOrderDropdownOpen ? '#05A8F9' : '#E0F2FE' }}
                onBlur={() => setTimeout(() => setSortOrderDropdownOpen(false), 200)}
              >
                <span className="text-gray-700">
                  {sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${sortOrderDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown de opciones */}
              {sortOrderDropdownOpen && (
                <div 
                  className="absolute z-10 w-full mt-1 bg-white border-2 rounded-xl shadow-lg overflow-hidden"
                  style={{ borderColor: '#E0F2FE' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder('desc')
                      setSortOrderDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Descendente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortOrder('asc')
                      setSortOrderDropdownOpen(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-t"
                    style={{ borderColor: '#F3F4F6' }}
                  >
                    Ascendente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-end gap-3 col-span-1 md:col-span-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              style={{
                background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                boxShadow: '0 4px 12px 0 rgba(0, 184, 212, 0.4)'
              }}
            >
              <Search className="w-4 h-4" />
              Aplicar filtros
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 px-5 py-3 font-bold rounded-xl transition-all duration-300 border-2"
              style={{
                backgroundColor: 'white',
                borderColor: '#E0F2FE',
                color: '#05A8F9'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F4FCFF'
                e.currentTarget.style.borderColor = '#6FBFDE'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
                e.currentTarget.style.borderColor = '#E0F2FE'
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* ========================================
          CARD DE TABLA
      ======================================== */}
      <div 
        className="bg-white rounded-2xl border-2 shadow-lg overflow-hidden"
        style={{ borderColor: '#E0F2FE' }}
      >
        {/* Header de la tabla */}
        <div className="p-6 border-b-2" style={{ borderColor: '#E0F2FE' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: '#05A8F9' }} />
              <h3 className="text-lg font-black text-gray-900">
                Usuarios registrados ({users.length})
              </h3>
            </div>
          </div>
        </div>

        {/* Contenido de la tabla */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div 
                  className="w-12 h-12 mx-auto border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: '#05A8F9', borderTopColor: 'transparent' }}
                />
                <p className="text-gray-600 text-sm font-medium">
                  Cargando usuarios...
                </p>
              </div>
            </div>
          ) : error ? (
            <div 
              className="rounded-xl border-2 p-6"
              style={{ 
                backgroundColor: '#FEF2F2',
                borderColor: '#FCA5A5'
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="w-12 h-12 text-red-600" />
                <p className="text-red-900 font-bold text-center">{error}</p>
                <button
                  onClick={loadUsers}
                  className="px-5 py-2.5 text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{
                    background: 'linear-gradient(to right, #00B8D4, #00ACC1)',
                  }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4" style={{ color: '#E0F2FE' }} />
              <p className="text-gray-600 font-medium">
                No se encontraron usuarios
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr 
                    className="border-b-2"
                    style={{ borderColor: '#E0F2FE' }}
                  >
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Edad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Género
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Gestos
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Templates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Registro
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Última Actividad
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr 
                      key={user.user_id}
                      className={`border-b transition-colors hover:bg-gray-50 ${
                        index === users.length - 1 ? 'border-b-0' : ''
                      }`}
                      style={{ 
                        borderColor: index === users.length - 1 ? 'transparent' : '#F3F4F6'
                      }}
                    >
                      {/* Usuario */}
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-bold text-gray-900">
                            {user.username}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {user.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <div className="text-gray-900 font-medium">
                            {user.email}
                          </div>
                          <div className="text-gray-500">
                            {user.phone_number}
                          </div>
                        </div>
                      </td>

                      {/* Edad */}
                      <td className="px-4 py-4">
                        <span className="text-gray-900 font-medium">
                          {user.age} años
                        </span>
                      </td>

                      {/* Género */}
                      <td className="px-4 py-4">
                        <span 
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: user.gender === 'Masculino' ? '#DBEAFE' : '#ECFEFF',
                            color: user.gender === 'Masculino' ? '#1E40AF' : '#0E7490'
                          }}
                        >
                          {user.gender}
                        </span>
                      </td>

                      {/* Gestos */}
                      {/* <td className="px-4 py-4">
                        <div className="flex gap-1">
                          {user.gesture_sequence?.slice(0, 3).map((gesture, idx) => (
                            <span
                              key={idx}
                              className="text-xl"
                              title={gesture}
                            >
                              {gesture === 'Open_Palm' && '🖐️'}
                              {gesture === 'Closed_Fist' && '✊'}
                              {gesture === 'Victory' && '✌️'}
                              {gesture === 'Thumb_Up' && '👍'}
                              {gesture === 'Thumb_Down' && '👎'}
                              {gesture === 'Pointing_Up' && '☝️'}
                              {gesture === 'ILoveYou' && '🤟'}
                            </span>
                          ))}
                        </div>
                      </td> */}

                      {/* Gestos */}
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {user.gesture_sequence?.slice(0, 3).map((gesture, idx) => (
                            <div
                              key={idx}
                              className="relative group"
                              title={gesture.replace('_', ' ')}
                            >
                              <img 
                                src={`/${gesture}.png`}
                                alt={gesture.replace('_', ' ')}
                                className="w-8 h-8 object-contain transition-transform hover:scale-110"
                              />
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Templates */}
                      <td className="px-4 py-4">
                        <span 
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: user.total_templates > 0 ? '#F0FDF4' : '#F3F4F6',
                            color: user.total_templates > 0 ? '#065F46' : '#6B7280'
                          }}
                        >
                          {user.total_templates}
                        </span>
                      </td>

                      {/* Fecha registro */}
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600 font-medium">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      {/* Última actividad */}
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600 font-medium">
                          {formatLastActivity(user.last_activity)}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewUser(user)}
                            title="Ver detalles"
                            className="p-2 rounded-lg transition-all duration-200 border-2"
                            style={{
                              backgroundColor: 'white',
                              borderColor: '#E0F2FE',
                              color: '#05A8F9'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F4FCFF'
                              e.currentTarget.style.borderColor = '#6FBFDE'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white'
                              e.currentTarget.style.borderColor = '#E0F2FE'
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            title="Editar"
                            className="p-2 rounded-lg transition-all duration-200 border-2"
                            style={{
                              backgroundColor: 'white',
                              borderColor: '#E0F2FE',
                              color: '#05A8F9'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F4FCFF'
                              e.currentTarget.style.borderColor = '#6FBFDE'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white'
                              e.currentTarget.style.borderColor = '#E0F2FE'
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            title="Eliminar"
                            className="p-2 rounded-lg transition-all duration-200 border-2"
                            style={{
                              backgroundColor: 'white',
                              borderColor: '#FCA5A5',
                              color: '#EF4444'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#FEF2F2'
                              e.currentTarget.style.borderColor = '#F87171'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white'
                              e.currentTarget.style.borderColor = '#FCA5A5'
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================
          MODALES
      ======================================== */}
      <UserDetailsModal
        user={selectedUser}
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setSelectedUser(null)
        }}
      />

      <EditUserModal
        user={selectedUser}
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedUser(null)
        }}
        onSuccess={() => {
          loadUsers()
        }}
      />

      <DeleteConfirmModal
        user={selectedUser}
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedUser(null)
        }}
        onSuccess={() => {
          loadUsers()
        }}
      />
    </div>
  )
}