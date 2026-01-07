
import { useEffect } from 'react';

const SquareCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    console.log('Square OAuth callback received:', { code, state });

    // Stage 2 ONLY.
    // Stage 3 (token exchange) is intentionally not implemented yet.
    // No API calls are allowed here.

    window.location.href = '/';
  }, []);

  return null;
};

export default SquareCallback;
