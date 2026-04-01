import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error'

export interface QueryEntry<T = unknown> {
  token: string
  status: QueryStatus
  data?: T
  error?: string
  updatedAt: number
}

interface ApiCacheState {
  queries: Record<string, QueryEntry>
}

const initialState: ApiCacheState = {
  queries: {},
}

const apiCacheSlice = createSlice({
  name: 'apiCache',
  initialState,
  reducers: {
    queryStarted: (state, action: PayloadAction<{ cacheKey: string; token: string }>) => {
      const { cacheKey, token } = action.payload
      const previous = state.queries[cacheKey]
      state.queries[cacheKey] = {
        token,
        status: 'loading',
        data: previous?.data,
        error: undefined,
        updatedAt: previous?.updatedAt ?? 0,
      }
    },
    querySucceeded: (state, action: PayloadAction<{ cacheKey: string; token: string; data: unknown }>) => {
      const { cacheKey, token, data } = action.payload
      state.queries[cacheKey] = {
        token,
        status: 'success',
        data,
        error: undefined,
        updatedAt: Date.now(),
      }
    },
    queryFailed: (state, action: PayloadAction<{ cacheKey: string; token: string; error: string }>) => {
      const { cacheKey, token, error } = action.payload
      const previous = state.queries[cacheKey]
      state.queries[cacheKey] = {
        token,
        status: 'error',
        data: previous?.data,
        error,
        updatedAt: Date.now(),
      }
    },
    invalidateToken: (state, action: PayloadAction<string>) => {
      const token = action.payload
      for (const [cacheKey, entry] of Object.entries(state.queries)) {
        if (entry.token === token) {
          delete state.queries[cacheKey]
        }
      }
    },
  },
})

export const { queryStarted, querySucceeded, queryFailed, invalidateToken } = apiCacheSlice.actions

export default apiCacheSlice.reducer
