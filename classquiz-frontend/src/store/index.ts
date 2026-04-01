import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import apiCacheReducer from './apiCacheSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    apiCache: apiCacheReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
