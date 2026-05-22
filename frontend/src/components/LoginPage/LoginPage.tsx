import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = window.location.port === '5173' || window.location.port === '3000'
    ? `http://${window.location.hostname}:5000/api/auth`
    : `${window.location.origin}/api/auth`;

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
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to main voice/text application on successful login
        window.location.href = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/';
      } else {
        setError(data.error || data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-overlay" />

      <div className="login-card">
        <div className="login-inner">

          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">We're so excited to see you again!</p>
          </div>

          <form className="login-form" onSubmit={handleLoginSubmit}>
            {error && (
              <div style={{ color: '#f23f43', fontSize: '14px', width: '100%', marginBottom: '16px', fontWeight: '500' }}>
                ⚠️ {error}
              </div>
            )}

            <div className="login-fields">
              <div className="field-group">
                <label className="field-label" htmlFor="email">EMAIL OR USERNAME</label>
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
                <label className="field-label" htmlFor="password">PASSWORD</label>
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
              {loading ? 'Logging in...' : 'Log In'}
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
