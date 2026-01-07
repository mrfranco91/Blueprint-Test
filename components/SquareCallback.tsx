
import { useEffect } from 'react';

const SquareCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      sessionStorage.setItem('square_oauth_complete', 'true');
      sessionStorage.setItem('square_oauth_code', code);
    }

    window.location.replace('/');
  }, []);

  return null;
};

export default SquareCallback;
