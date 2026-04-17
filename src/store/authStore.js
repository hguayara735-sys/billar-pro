import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  rol: null,

  setSession: async (session) => {
    if (!session) {
      set({ session: null, user: null, loading: false, rol: null })
      return
    }
    let rol = 'admin'
    const { data } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('email', session.user.email)
      .single()
    if (data?.rol) rol = data.rol
    set({ session, user: session.user, loading: false, rol })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, rol: null })
  },
}))
