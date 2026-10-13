import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const offlineOnlyMode = import.meta.env.VITE_OFFLINE_MODE === "true";

// A release can intentionally run entirely on-device, even if cloud credentials
// exist in the build environment. This prevents auth and cloud sync initialization.
export const supabaseConfigured =
  !offlineOnlyMode &&
  typeof SUPABASE_URL === "string" &&
  /^https:\/\/[^\s/]+\.supabase\.co$/.test(SUPABASE_URL) &&
  typeof SUPABASE_PUBLISHABLE_KEY === "string" &&
  SUPABASE_PUBLISHABLE_KEY.length > 20;

export const supabase: SupabaseClient<Database> | null = supabaseConfigured
  ? createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: brokeredPreviewStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
