import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to initialize database tables dynamically via REST
// Note: Normally this is done via SQL Editor, but we will attempt to create them 
// if they respond with 404 (Not Found)
export const setupDatabase = async () => {
    if (supabaseUrl === 'https://placeholder.supabase.co') return;

    try {
        // Quick check if contacts table exists
        const { error: contactsCheck } = await supabase.from('contacts').select('id').limit(1);

        // PGRST205 means table doesn't exist in schema cache
        if (contactsCheck && contactsCheck.code === 'PGRST205') {
            console.log("Tables missing, attempting to create them via RPC or SQL...");
            // Because standard Supabase REST API (anon key) does not allow DDL (CREATE TABLE),
            // we have to notify the user they must execute the SQL. A pure client-side 
            // table creation with anon key is structurally blocked by Postgres roles.

            // Wait, we can't create tables purely from frontend with Anon key for security.
            // Let's log a highly visible warning to the console.
            console.error("CRITICAL SETUP REQUIRED:");
            console.error("1. Go to Supabase Dashboard -> SQL Editor");
            console.error("2. Paste and Run the contents of supabase_schema.sql");
            alert("Database tables are missing! You MUST run the supabase_schema.sql script in your Supabase SQL Editor. Client-side table creation is blocked by Supabase security.");
        }
    } catch (err) {
        console.error("DB Check error:", err);
    }
};
