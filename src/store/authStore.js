import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  rol: null,
  salonId: null,

  setSession: async (session) => {
    if (!session) {
      set({ session: null, user: null, loading: false, rol: null, salonId: null })
      return
    }
    let rol = 'admin'
    let salonId = null
    const { data } = await supabase
      .from('usuarios')
      .select('rol, salon_id')
      .eq('email', session.user.email)
      .single()
    if (data?.rol) rol = data.rol
    if (data?.salon_id) salonId = data.salon_id
set({ session, user: session.user, loading: false, rol, salonId })
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
