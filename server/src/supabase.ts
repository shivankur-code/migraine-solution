// Still's Supabase project, used to check a person's sign-in. The URL and the publishable key are
// public (the app ships them too, see src/lib/supabase.ts); the secret key is never used here.
// App settings SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY override them.
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bhbsttmdcsyfycutwksy.supabase.co';
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_21vVOAaHe3-h65xjmigdmQ_Re_jy13C';
