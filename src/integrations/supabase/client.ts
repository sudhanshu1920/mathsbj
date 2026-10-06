// Browser-safe Supabase client configuration.
// Web deployments provide these values through Vite environment variables.
// Native/CI builds may not have the browser environment, so keep startup
// resilient and let the app operate in guest/offline mode until cloud config
// is supplied.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const DEFAULT_SUPABASE_URL = 'https://tkgogvbfxzookxlqjdtt.supabase.co';
const OFFLINE_PUBLISHABLE_KEY = 'native-offline-publishable-key';

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_CONFIGURED = Boolean(configuredUrl && configuredKey);
const SUPABASE_URL = configuredUrl || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = configuredKey || OFFLINE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});
