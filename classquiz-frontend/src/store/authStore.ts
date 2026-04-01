import { useMemo } from 'react'
import { useAppDispatch, useAppSelector } from './hooks'
import { logout as logoutAction, setAuth as setAuthAction } from './authSlice'

interface AuthState {
  token: string | null
  user: { username: string; role: string } | null
  setAuth: (token: string, user: { username: string; role: string }) => void
  logout: () => void
  isAuthenticated: boolean
}

export function useAuthStore(): AuthState {
  const dispatch = useAppDispatch()
  const { token, user, isAuthenticated } = useAppSelector((state) => state.auth)

  return useMemo(
    () => ({
      token,
      user,
      isAuthenticated,
      setAuth: (nextToken: string, nextUser: { username: string; role: string }) => {
        dispatch(setAuthAction({ token: nextToken, user: nextUser }))
      },
      logout: () => {
        dispatch(logoutAction())
      },
    }),
    [dispatch, isAuthenticated, token, user]
  )
}
