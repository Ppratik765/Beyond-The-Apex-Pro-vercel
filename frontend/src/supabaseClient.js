import { createClient } from '@supabase/supabase-js'

// REPLACE THESE WITH YOUR SUPABASE KEYS
const supabaseUrl = 'https://zdjeikhitvnydswueerk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkamVpa2hpdHZueWRzd3VlZXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNjY0NDgsImV4cCI6MjA4MTc0MjQ0OH0.xdd1Cr6dhbYhTuoPTaMCzUg2UD1Idin-wlrpRBHkRPA'

export const supabase = createClient(supabaseUrl, supabaseKey)
