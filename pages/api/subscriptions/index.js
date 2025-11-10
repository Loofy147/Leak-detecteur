
import { createServerClient } from '@supabase/ssr';
import { getCookies, setCookie } from 'cookies-next';

export default async function handler(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get: (name) => getCookies({ req, res })[name],
        set: (name, value, options) => setCookie(name, value, { req, res, ...options }),
        remove: (name, options) => setCookie(name, '', { req, res, ...options }),
      },
    }
  );

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (subscriptionsError) {
    return res.status(500).json({ error: subscriptionsError.message });
  }

  res.status(200).json(subscriptions);
}
