import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // 1. Iniciar sesión para obtener token
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'jack_franklin123@hotmail.com', // Let's guess the user email from Windows username or just use a dummy
        password: 'password123'
    });
    // Wait, I cannot guess the user's password. 
}

// better to change the edge function to log more details.
