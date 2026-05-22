import './LoginPage.css';

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-bg-overlay" />

      <div className="login-card">
        <div className="login-inner">

          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">We're so excited to see you agian!</p>
          </div>

          <div className="login-form">
            <div className="login-fields">
              <div className="field-group">
                <label className="field-label" htmlFor="email">EMAIL OR PHONE NUMBER</label>
                <input
                  id="email"
                  type="text"
                  className="field-input"
                  autoComplete="username"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="field-input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <a href="#" className="forgot-link">Forgot your password?</a>

            <button type="submit" className="login-btn">Log in</button>

            <p className="register-text">
              Need an account?{' '}
              <a href="#" className="register-link">Register</a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
