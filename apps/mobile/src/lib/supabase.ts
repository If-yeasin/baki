import { createClient } from "@supabase/supabase-js";

import type { Database } from "@baki/db";

import { storage } from "./mmkv";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const mmkvStorage = {
  getItem: (key: string) => {
    const value = storage.getString(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: (key: string) => {
    storage.delete(key);
    return Promise.resolve();
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  }
};

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl : "https://baki-disabled.invalid",
  isSupabaseConfigured ? supabaseAnonKey : "disabled",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: mmkvStorage
    },
    global: {
      headers: {
        "x-client-info": "baki-mobile"
      }
    }
  }
);
