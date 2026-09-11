import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchMe, login as loginApi, logout as logoutApi } from '../api/auth'
import { clearTokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('acadexa_access_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  const login = async (email, password) => {
    await loginApi(email, password)
    const me = await fetchMe()
    setUser(me)
    return me
  }

  const logout = async () => {
    await logoutApi()
    setUser(null)
  }

  const hasPermission = (code) => {
    if (!user) return false
    if (user.role_name === 'SUPER_ADMIN') return true
    return user.permissions.includes(code)
  }

  const hasRole = (...roles) => {
    if (!user) return false
    return roles.includes(user.role_name)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
