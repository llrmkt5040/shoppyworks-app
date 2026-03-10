import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import AppLayout from './components/AppLayout'
import './styles/global.css'

function App() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem', background:'#07080b' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(255,255,255,0.1)', borderTopColor:'#ff6b2b', borderRadius:'50%', animation:'spin 0.75s linear infinite' }} />
      <div style={{ fontSize:'0.85rem', color:'#6b7280' }}>認証確認中...</div>
    </div>
  )
  return user ? <AppLayout /> : <LoginPage />
}

createRoot(document.getElementById('root')).render(
  
    <AuthProvider>
      <App />
    </AuthProvider>
  
)
