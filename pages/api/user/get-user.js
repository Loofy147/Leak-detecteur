
/**
 * @fileoverview API endpoint to fetch user data.
 * In a real application, this would be a protected route that returns the authenticated user's data.
 */

/**
 * Handles the request to fetch user data.
 * Currently, it returns a mock user for demonstration purposes.
 * @param {import('next').NextApiRequest} req - The Next.js API request object.
 * @param {import('next').NextApiResponse} res - The Next.js API response object.
 * @returns {void}
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In a real application, you would fetch the user from a session or token.
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'user@example.com',
    createdAt: new Date().toISOString(),
  };

  res.status(200).json(mockUser);
}
