import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

// --- ASSETS ---
import maxVideo from './assets/max_verstappen.mp4'; 
// IMPORT THE STATIC IMAGE (Snapshot of the first frame of the video)
import maxPoster from './assets/max_poster.png'; 

// --- ANIMATION VARIANTS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

function LandingPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [message, setMessage] = useState(null);

  // --- AUTH LOGIC ---

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin 
      }
    });
    if (error) setMessage({ type: 'error', text: error.message });
    setLoading(false);
  };

  const handleAppleLogin = async () => {
    alert("Apple Sign-In is coming in the Professional tier update!");
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName } 
        }
      });
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: "✅ Account created! Check your email to verify." });
        setAuthMode('login'); 
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        if(onLoginSuccess) onLoginSuccess(data.session);
      }
    }
    setLoading(false);
  };

  // --- UI COMPONENTS ---

  return (
    <div className="landing-container">
      
      {/* --- BACKGROUND VIDEO START --- */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -2,
        overflow: 'hidden'
      }}>
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          preload="auto" /* Tells browser to download immediately */
          poster={maxPoster} /* Shows this image instantly while video loads */
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          <source src={maxVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Dark Overlay to ensure text readability */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)', 
          zIndex: 1
        }}></div>
      </div>
      {/* --- BACKGROUND VIDEO END --- */}

      {/* BACKGROUND EFFECTS */}
      <div className="bg-glow"></div>

      {/* NAVBAR */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="navbar"
      >
        <div className="logo">🏎️ Beyond The Apex</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <button onClick={() => setAuthMode('login')} className="btn-nav">Log In</button>
          <button onClick={() => setAuthMode('signup')} className="btn-nav btn-primary">Sign Up</button>
        </div>
      </motion.nav>

      {/* HERO SECTION */}
      <header className="hero">
        <div className="hero-content">
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={staggerContainer}
            className="hero-text"
          >
            <motion.h1 variants={fadeInUp}>
              Data at <span className="neon-text">300km/h</span>
            </motion.h1>
            <motion.p variants={fadeInUp}>
              Analyze Formula 1 telemetry like a Race Engineer. 
              Uncover the gaps, visualize strategies, and master the track.
            </motion.p>
          </motion.div>
          
          {/* DYNAMIC AUTH BOX */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="auth-box glass-panel"
          >
            <h3>{authMode === 'login' ? 'Welcome Back, Driver' : 'Join the Grid'}</h3>
            
            {message && (
              <div className={`msg-alert ${message.type}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleEmailAuth}>
              {authMode === 'signup' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    required 
                  />
                </motion.div>
              )}
              
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              
              <button type="submit" disabled={loading} className="btn-submit">
                {loading ? 'Processing...' : (authMode === 'login' ? 'Enter Pit Wall' : 'Create Account')}
              </button>
            </form>

            <div className="divider"><span>OR</span></div>

            <div className="social-login">
               <button onClick={handleGoogleLogin} className="btn-social">
                 <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.27C4.672 5.143 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                 Continue with Google
               </button>
               <button onClick={handleAppleLogin} className="btn-social">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-.89 3.12-.68 3.76.75 4.07 3.61 2.33 6.19-.42 1.08-1.26 2.18-1.55 2.62-.28.43-.66.89-.98 1.1zm-3.85-13.7c.64-1.26 1.83-1.63 2.92-1.58.33 1.63-1.26 2.98-2.43 3.01-.76-.02-1.84-.71-1.39-1.43z"/></svg>
                 Continue with Apple
               </button>
            </div>

            <p className="switch-auth">
              {authMode === 'login' ? "New here? " : "Already a member? "}
              <span onClick={() => {setMessage(null); setAuthMode(authMode === 'login' ? 'signup' : 'login');}}>
                {authMode === 'login' ? 'Create Account' : 'Log In'}
              </span>
            </p>
          </motion.div>
        </div>
      </header>

      {/* FEATURES SCROLL SECTION */}
      <section id="features" className="instructions">
        <motion.h2 
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }} 
          viewport={{ once: true }}
        >
          Master the Telemetry
        </motion.h2>
        <div className="cards-wrapper">
            {[ 
              { title: "1. Select Race", desc: "Access the full archive from 2021.", delay: 0 },
              { title: "2. Choose Drivers", desc: "Head-to-head comparison between any drivers.", delay: 0.2 },
              { title: "3. Analyse Gaps", desc: "Pinpoint braking points and throttle traces.", delay: 0.4 }
            ].map((step, i) => (
                <motion.div 
                    key={i}
                    className="step-card"
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: step.delay, duration: 0.5 }}
                >
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                </motion.div>
            ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="pricing-section">
        <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>Plans</motion.h2>
        <div className="pricing-grid">
            {['Rookie', 'Hobbyist', 'Professional'].map((plan, i) => (
                <motion.div 
                    key={plan}
                    className={`price-card ${plan === 'Hobbyist' ? 'featured' : ''}`}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                >
                    <h3>{plan}</h3>
                    <div className="price">{plan === 'Rookie' ? 'Free' : (plan === 'Hobbyist' ? '$5' : '$15')}</div>
                    <ul>
                        <li>Historic Data</li>
                        <li>{plan === 'Rookie' ? 'Basic Charts' : 'Advanced Telemetry'}</li>
                        <li>{plan === 'Professional' ? 'Priority Support' : 'Community Support'}</li>
                    </ul>
                    <button className={plan === 'Hobbyist' ? 'btn-primary' : ''}>Select</button>
                </motion.div>
            ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="contact-section">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>
            <h2>Contact Race Control</h2>
            <a href="mailto:support@beyondtheapex.com" className="email-link">support@beyondtheapex.com</a>
        </motion.div>
      </section>
    </div>
  );
}

export default LandingPage;