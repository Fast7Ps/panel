// =============================================================
// FAST7 Commercial — SUPER-ADMIN PANEL
// Connection to the COMPANY'S MASTER Supabase project.
//
// 1) Create your company's master Supabase project at supabase.com
// 2) In its SQL Editor, run:  supabase/master/schema.sql
// 3) Fill the three values below from the master project settings.
// 4) Then follow the Auth setup step in the README.
//
// IMPORTANT: This is the MASTER DB (the company). It only TRACKS
// stores/subscriptions. Each store keeps its data in its OWN
// isolated Supabase project (per-store credentials are stored in the
// `stores` table and entered via the panel UI, never hardcoded here).
// =============================================================
window.SUPERADMIN_CONFIG = {
  // ===== Company's MASTER Supabase project (filled with YOUR project) =====
  SUPABASE_URL: 'https://scmgwkabtybtrmxdqniz.supabase.co',
  // anon key ONLY (public, safe for a client-side panel). NEVER put the
  // service_role secret here — that would let anyone take over your project.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjbWd3a2FidHlidHJteGRxbml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjA3NDcsImV4cCI6MjEwMTQzNjc0N30.Lwqif_ViU7XJoO_zz_wovovOroIYvqpg3m0CJaCmi5w'
};