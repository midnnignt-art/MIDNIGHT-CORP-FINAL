
import { createClient } from '@supabase/supabase-js';

// Credentials provided by the user
const supabaseUrl = 'https://wlhqltksjbkrcyrksjlz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaHFsdGtzamJrcmN5cmtzamx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMDY3NzcsImV4cCI6MjA4Njc4Mjc3N30.honkLqrlMSkBUDv5nL3BlCvykcjlH-eac_IiC_l1n1g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
