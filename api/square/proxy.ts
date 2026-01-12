import type { VercelRequest, VercelResponse } from '@vercel/node';

// This serverless function has been disabled as part of the Square OAuth stabilization patch.
// API calls are now made directly from the client.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(410).json({ message: 'This endpoint is no longer available.' });
}
