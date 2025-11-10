
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { createServerClient } from '@supabase/ssr';
import { getCookies, setCookie } from 'cookies-next';

export default function Dashboard({ user }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const response = await fetch('/api/subscriptions');
        if (!response.ok) {
          throw new Error('Failed to fetch subscriptions');
        }
        const data = await response.json();
        setSubscriptions(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-lg text-gray-600">
            Welcome, {user.email}!
          </p>

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900">Your Subscriptions</h2>
            {loading ? (
              <p>Loading...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : subscriptions.length === 0 ? (
              <p>You have no subscriptions.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {subscriptions.map((sub) => (
                  <li key={sub.id} className="bg-white p-4 rounded-lg shadow-md">
                    <p className="font-bold">{sub.merchant_name}</p>
                    <p>Monthly Cost: ${sub.monthly_cost}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ req, res }) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: { user },
  };
}
