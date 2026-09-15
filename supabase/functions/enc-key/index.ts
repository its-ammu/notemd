// enc-key — returns the single app-wide encryption key to signed-in users only.
//
// The key lives as a Supabase secret (NOTEMD_ENC_KEY), never in the database and
// never in the JS bundle, so a database dump on its own yields only ciphertext.
//
// IMPORTANT: verify_jwt = true (the default) lets the gateway through for ANY
// valid Supabase JWT — including the public anon key that ships in the bundle.
// So we additionally call auth.getUser(): a real logged-in session resolves to a
// user; the anon key resolves to none and is rejected.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  // Tighten to your app's origin in production, e.g. 'https://notemd.app'.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const key = Deno.env.get('NOTEMD_ENC_KEY');
  if (!key) return json({ error: 'encryption key not configured' }, 500);

  return json({ key });
});
