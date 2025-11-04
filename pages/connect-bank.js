// pages/connect-bank.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export default function ConnectBank() {
  const router = useRouter();
  const { audit_id: auditId } = router.query;
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    async function fetchLinkToken() {
      if (auditId) {
        try {
          const response = await fetch('/api/plaid/create-link-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auditId }),
          });
          const data = await response.json();
          if (data.link_token) {
            setLinkToken(data.link_token);
          } else {
            console.error('Failed to fetch link token:', data.error);
          }
        } catch (error) {
          console.error('Error fetching link token:', error);
        }
      }
    }
    fetchLinkToken();
  }, [auditId]);

  const onSuccess = async (public_token, metadata) => {
    try {
      await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token, auditId }),
      });
      router.push('/analysis-in-progress');
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  useEffect(() => {
    if (ready) {
      open();
    }
  }, [ready, open]);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Connecting to your bank...</h1>
      <p>Plaid Link should open automatically.</p>
    </div>
  );
}
