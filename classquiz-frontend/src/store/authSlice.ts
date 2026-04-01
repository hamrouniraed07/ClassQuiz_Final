import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  username: string
  role: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
}

function loadPersistedUser(): AuthUser | null {
  const persisted = localStorage.getItem('classquiz-auth')
  if (!persisted) return null

  try {
    const parsed = JSON.parse(persisted) as { state?: { user?: AuthUser } }
    return parsed?.state?.user ?? null
  } catch {
    return null
  }
}

const initialToken = localStorage.getItem('cq_token')
const initialUser = loadPersistedUser()

const initialState: AuthState = {
  token: initialToken,
  user: initialUser,
  isAuthenticated: Boolean(initialToken),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ token: string; user: AuthUser }>) => {
      const { token, user } = action.payload
      localStorage.setItem('cq_token', token)
      localStorage.setItem('classquiz-auth', JSON.stringify({ state: { token, user, isAuthenticated: true }, version: 0 }))
      state.token = token
      state.user = user
      state.isAuthenticated = true
    },
    logout: (state) => {
      localStorage.removeItem('cq_token')
      localStorage.removeItem('classquiz-auth')
      state.token = null
      state.user = null
      state.isAuthenticated = false
    },
  },
})

export const { setAuth, logout } = authSlice.actions

export default authSlice.reducer
