import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Parse hash manually — Supabase v2 doesn't always fire PASSWORD_RECOVERY
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token") ?? "";
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          setReady(true);
        });
        return;
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      window.location.href = "/";
    }, 3000);
    return () => clearTimeout(timer);
  }, [success]);

  function validate() {
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (password !== confirm) return "Las contraseñas no coinciden.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const msg = validate();
    if (msg) { setError(msg); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-green-600 p-3 rounded-full mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
          <p className="text-gray-400 text-sm mt-1 text-center">
            Ingresa y confirma tu nueva contraseña
          </p>
        </div>

        {!ready && !success && (
          <p className="text-center text-gray-400 text-sm">
            Esperando enlace de recuperación…
          </p>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 pr-10 border border-gray-600 focus:outline-none focus:border-green-500 placeholder-gray-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2.5 pr-10 border border-gray-600 focus:outline-none focus:border-green-500 placeholder-gray-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}

        {success && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle size={48} className="text-green-500" />
            <p className="text-white font-semibold text-lg">
              ¡Contraseña actualizada!
            </p>
            <p className="text-gray-400 text-sm">
              Redirigiendo al inicio en 3 segundos…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
