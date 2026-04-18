import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json().catch(() => ({}))

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: createErr } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (createErr && !createErr.message.includes('already registered')) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://billar-pro-orpin.vercel.app/reset-password' },
    })

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Bienvenido a Billar Pro - Crea tu contraseña',
        html: `<p>Has sido invitado a Billar Pro. Haz clic en el siguiente enlace para crear tu contraseña:</p><p><a href="${linkData.properties.action_link}">Crear contraseña</a></p>`,
      }),
    })

    if (!resendRes.ok) {
      const resendErr = await resendRes.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: resendErr.message ?? 'Error enviando email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
