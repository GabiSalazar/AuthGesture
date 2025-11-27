import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Landing from './pages/landing/Landing'
import AdminPanel from './pages/admin/AdminPanel'
import AdminLogin from './pages/admin/AdminLogin'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Enrollment from './pages/enrollment/Enrollment'
import Verification from './pages/verification/Verification'
import Identification from './pages/identification/Identification'

import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        {/* Páginas públicas SIN Layout (Fullscreen) */}
        <Route path="/" element={<Landing />} />
        <Route path="/enrollment" element={<Enrollment />} />
        <Route path="/verification" element={<Verification />} />
        <Route path="/identification" element={<Identification />} />
        
        {/* Login de Admin (PÚBLICO - no requiere autenticación) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Admin panel PROTEGIDO - Requiere autenticación para acceder */}
        {/* Esto protege /admin/dashboard y todas las subrutas del admin */}
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  )
}

export default App