import { useState, useEffect } from 'react'
import { adminApi } from '../../../lib/api/admin'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Select
} from '../../../components/ui'
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Download
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
  
  // Estados de modales (los crearemos después)
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
    // Recargar después de limpiar
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-500 mt-1">
            Administra usuarios registrados en el sistema
          </p>
        </div>
        <Button
          onClick={loadUsers}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <Input
              label="Buscar"
              placeholder="Nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
            />

            {/* Filtro género */}
            <Select
              label="Género"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </Select>

            {/* Edad mínima */}
            <Input
              label="Edad mínima"
              type="number"
              placeholder="Ej: 18"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />

            {/* Edad máxima */}
            <Input
              label="Edad máxima"
              type="number"
              placeholder="Ej: 65"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
            />

            {/* Ordenar por */}
            <Select
              label="Ordenar por"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at">Fecha de registro</option>
              <option value="username">Nombre</option>
              <option value="age">Edad</option>
              <option value="templates">Templates</option>
              <option value="last_activity">Última actividad</option>
            </Select>

            {/* Orden */}
            <Select
              label="Orden"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </Select>

            {/* Botones */}
            <div className="flex items-end gap-2 col-span-2">
              <Button
                onClick={handleApplyFilters}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Aplicar Filtros
              </Button>
              <Button
                onClick={handleClearFilters}
                variant="outline"
                className="flex-1"
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuarios Registrados ({users.length})
            </CardTitle>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-4" />
                <p className="text-gray-600">Cargando usuarios...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <Button onClick={loadUsers} className="mt-4">
                Reintentar
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Género</TableHead>
                    <TableHead>Gestos</TableHead>
                    <TableHead>Templates</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Última Actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      {/* Usuario */}
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.username}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {user.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>

                      {/* Contacto */}
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-gray-900">{user.email}</div>
                          <div className="text-gray-500">{user.phone_number}</div>
                        </div>
                      </TableCell>

                      {/* Edad */}
                      <TableCell>
                        <span className="text-gray-900">{user.age} años</span>
                      </TableCell>

                      {/* Género */}
                      <TableCell>
                        <Badge variant={user.gender === 'Masculino' ? 'primary' : 'info'}>
                          {user.gender}
                        </Badge>
                      </TableCell>

                      {/* Gestos */}
                      <TableCell>
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
                      </TableCell>

                      {/* Templates */}
                      <TableCell>
                        <Badge variant={user.total_templates > 0 ? 'success' : 'default'}>
                          {user.total_templates}
                        </Badge>
                      </TableCell>

                      {/* Fecha registro */}
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDate(user.created_at)}
                        </span>
                      </TableCell>

                      {/* Última actividad */}
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatLastActivity(user.last_activity)}
                        </span>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewUser(user)}
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteUser(user)}
                            title="Eliminar"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
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
          loadUsers() // Recargar lista después de editar
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
          loadUsers() // Recargar lista después de eliminar
        }}
      />
    </div>
  )
}