import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import RegisterPage from './components/RegisterPage/RegisterPage';
import HomePage from './components/HomePage/HomePage';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);

    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({}, '', '/login');
      setRoute('/login');
    }

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (route === '/register') return <RegisterPage />;
  if (route === '/home') return <HomePage />;

  return <LoginPage />;
}
