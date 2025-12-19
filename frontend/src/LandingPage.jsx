import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './index.css'; // Ensure CSS is imported

function LandingPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [message, setMessage] = useState('');

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else onLoginSuccess(data.session);
    setLoading(false);
  };

  // Handle Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else setMessage("✅ Check your email for the confirmation link!");
    setLoading(false);
  };

  return (
    <div className="landing-container">
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <div className="logo">🏎️ Beyond The Apex</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
          <button onClick={() => setAuthMode('login')} className="btn-nav">Log In</button>
          <button onClick={() => setAuthMode('signup')} className="btn-nav btn-primary">Sign Up</button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="hero">
        <div className="hero-content">
          <h1 className="fade-in">Data at 300km/h</h1>
          <p className="slide-up">
            Analyze Formula 1 telemetry like a Race Engineer. 
            Compare drivers, visualize strategies, and uncover the gaps.
          </p>
          
          {/* AUTH BOX */}
          <div className="auth-box glass-panel">
            <h3>{authMode === 'login' ? 'Welcome Back' : 'Join the Grid'}</h3>
            {message && <p className="msg-alert">{message}</p>}
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="submit" disabled={loading}>
                {loading ? 'Processing...' : (authMode === 'login' ? 'Log In' : 'Sign Up')}
              </button>
            </form>
            <p className="switch-auth">
              {authMode === 'login' ? "New here? " : "Already have an account? "}
              <span onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                {authMode === 'login' ? 'Create Account' : 'Log In'}
              </span>
            </p>
            <div className="social-login">
               <p>Or continue with</p>
               <div className="social-icons">
                 <button>Google</button> <button>Apple</button>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- SCROLL INSTRUCTIONS --- */}
      <section id="features" className="instructions">
        <h2>How it Works</h2>
        <div className="step-card scroll-reveal">
            <h3>1. Select Race</h3>
            <p>Choose any Grand Prix from 2018 to 2024.</p>
        </div>
        <div className="step-card scroll-reveal" style={{transitionDelay: '200ms'}}>
            <h3>2. Choose Drivers</h3>
            <p>Compare telemetry between Max, Lewis, or Lando.</p>
        </div>
        <div className="step-card scroll-reveal" style={{transitionDelay: '400ms'}}>
            <h3>3. Analyze Gaps</h3>
            <p>See exactly where time is lost in corners.</p>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="pricing-section">
        <h2>Choose Your Team</h2>
        <div className="pricing-grid">
            <div className="price-card">
                <h3>Rookie</h3>
                <div className="price">Free</div>
                <ul>
                    <li>Recent Races Only</li>
                    <li>Basic Telemetry</li>
                    <li>Community Support</li>
                </ul>
                <button>Current Plan</button>
            </div>
            <div className="price-card featured">
                <h3>Hobbyist</h3>
                <div className="price">$5<span>/mo</span></div>
                <ul>
                    <li>All Historic Data</li>
                    <li>Advanced G-Force Charts</li>
                    <li>Save Favorite Drivers</li>
                </ul>
                <button className="btn-primary">Go Pro</button>
            </div>
            <div className="price-card">
                <h3>Professional</h3>
                <div className="price">$15<span>/mo</span></div>
                <ul>
                    <li>Team Strategy Analysis</li>
                    <li>API Access</li>
                    <li>Priority Support</li>
                </ul>
                <button>Contact Sales</button>
            </div>
        </div>
      </section>

      {/* --- CONTACT --- */}
      <section id="contact" className="contact-section">
        <h2>Contact Race Control</h2>
        <p>Have a feature request or found a bug?</p>
        <a href="mailto:support@beyondtheapex.com" className="email-link">support@beyondtheapex.com</a>
      </section>
    </div>
  );
}

export default LandingPage;
