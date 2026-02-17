
// import { createClient } from '@supabase/supabase-js';

// --- OFFLINE MODE ACTIVATED ---
// Supabase connection disabled by user request to return to local state management.
// To re-enable, uncomment lines below and in StoreContext.

// const supabaseUrl = '...';
// const supabaseAnonKey = '...';

// export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dummy export to prevent import errors in other files if any remain
export const supabase = {
    from: () => ({ select: () => ({}), insert: () => ({}), update: () => ({}), delete: () => ({}) })
};
