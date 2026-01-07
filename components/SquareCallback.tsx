
import { useEffect } from 'react';

const SquareCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    console.log('Square OAuth callback received:', { code, state });

    if (code) {
      sessionStorage.setItem('square_oauth_code', code);
      sessionStorage.setItem('square_oauth_complete', 'true');
    }

    window.location.href = '/';
  }, []);

  return null;
};

export default SquareCallback;
