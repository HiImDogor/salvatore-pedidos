if (window.supabase && window.SALVATORE_SUPABASE_CONFIG) {
  window.salvatoreSupabase = window.supabase.createClient(
    window.SALVATORE_SUPABASE_CONFIG.url,
    window.SALVATORE_SUPABASE_CONFIG.publishableKey
  );
}
