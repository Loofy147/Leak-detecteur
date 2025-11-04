/**
 * @fileoverview This page handles the Plaid Link flow for connecting a user's bank account.
 * It retrieves a Plaid Link token, initializes the Plaid Link component, and handles the
 * success callback to exchange the public token for an access token.
 */
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

/**
 * A React component that manages the Plaid Link integration.
 * It fetches a Plaid Link token, opens the Plaid Link modal, and handles the token exchange
 * on a successful connection.
 * @returns {JSX.Element} The rendered ConnectBank component.
 */
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
