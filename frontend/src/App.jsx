import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div className="loading-screen">Starting Engine...</div>;

  return (
    <>
      {!session ? (
        <LandingPage onLoginSuccess={setSession} />
      ) : (
        <Dashboard session={session} handleLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
