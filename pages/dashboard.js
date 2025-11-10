
import React from 'react';
import Head from 'next/head';

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>Dashboard</title>
      </Head>
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-lg text-gray-600">
            Welcome to your subscription management dashboard.
          </p>
        </div>
      </div>
    </>
  );
}
