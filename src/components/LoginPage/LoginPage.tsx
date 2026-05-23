import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import FloatingParticles from '../FloatingParticles/FloatingParticles';
import './LoginPage.css';

import api from '../../utils/api';

export default function LoginPage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 30, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, []);

  // SPA navigation helper
  const handleNavigate = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data;
      if (data.success) {
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect to main voice/text application on successful login
        window.history.pushState({}, '', '/home');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        setError(data.error || data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Connection failed. Is the server running?';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-overlay" />
      <FloatingParticles />

      <div className="login-card" ref={cardRef}>
        <div className="login-inner">

          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">We're so excited to see you agian!</p>
          </div>

          <form className="login-form" onSubmit={handleLoginSubmit}>
            {error && (
              <div style={{ color: '#f23f43', fontSize: '14px', width: '100%', marginBottom: '16px', fontWeight: '500' }}>
                ⚠️ {error}
              </div>
            )}

            <div className="login-fields">
              <div className="field-group">
                <label className="field-label" htmlFor="email">EMAIL OR PHONE NUMBER</label>
                <input
                  id="email"
                  type="text"
                  className="field-input"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="field-input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <a href="#" onClick={(e) => e.preventDefault()} className="forgot-link">Forgot your password?</a>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <p className="register-text">
              Need an account?{' '}
              <a href="/register" onClick={(e) => handleNavigate(e, '/register')} className="register-link">Register</a>
            </p>
          </form>

        </div>
      </div>
    </div>
  );
}
