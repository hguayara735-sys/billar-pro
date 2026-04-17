import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function LoginForm() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openReset() {
    setResetEmail(email)
    setResetError(null)
    setResetSent(false)
    setResetMode(true)
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: 'https://billar-pro-orpin.vercel.app',
    })
    setResetLoading(false)
    if (err) { setResetError(err.message); return }
    setResetSent(true)
  }

  if (resetMode) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Billar Pro</h1>
        <p className="text-sm text-gray-400 text-center">
          Ingresa tu correo y te enviaremos un enlace para crear tu contraseña.
        </p>

        {resetSent ? (
          <p className="text-green-400 text-sm text-center">
            Revisa tu correo, te enviamos el enlace para crear tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}
            <input
              type="email"
              placeholder="Correo"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={resetLoading}
              className="py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
            >
              {resetLoading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <button
          onClick={() => setResetMode(false)}
          className="text-xs text-gray-500 hover:text-gray-300 text-center transition-colors"
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center">Billar Pro</h1>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
      />

      <button
        type="submit"
        disabled={loading}
        className="py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <button
        type="button"
        onClick={openReset}
        className="text-xs text-gray-500 hover:text-gray-300 text-center transition-colors"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  )
}
