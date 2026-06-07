import { useMutation } from "@tanstack/react-query";

import { Sentry } from "@/lib/sentry";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import { normalizeBdPhone } from "./phone";
import { persistUserId } from "./use-session";

type RequestOtpInput = {
  phone: string;
};

type VerifyOtpInput = {
  otp: string;
  phone: string;
};

type UpsertProfileInput = {
  displayName: string;
  phone: string;
};

export function useRequestOtp() {
  return useMutation({
    mutationFn: async ({ phone }: RequestOtpInput) => {
      if (!isSupabaseConfigured) {
        throw new Error("auth.error.otp_failed");
      }

      const normalizedPhone = normalizeBdPhone(phone);
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });

      if (error) {
        throw error;
      }

      return { phone: normalizedPhone };
    }
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async ({ otp, phone }: VerifyOtpInput) => {
      if (!isSupabaseConfigured) {
        throw new Error("auth.error.otp_expired");
      }

      const normalizedPhone = normalizeBdPhone(phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: "sms"
      });

      if (error) {
        throw error;
      }

      if (data.user?.id) {
        persistUserId(data.user.id);
      }

      return data;
    }
  });
}

export function useUpsertProfile() {
  return useMutation({
    mutationFn: async ({ displayName, phone }: UpsertProfileInput) => {
      if (!isSupabaseConfigured) {
        throw new Error("auth.error.notSignedIn");
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("auth.error.notSignedIn");
      }

      const normalizedPhone = normalizeBdPhone(phone);
      const { error } = await supabase.from("profiles").upsert({
        default_currency: "BDT",
        display_name: displayName.trim(),
        id: user.id,
        locale: "bn",
        phone: normalizedPhone
      });

      if (error) {
        Sentry.captureException(error, { tags: { feature: "auth.profile.upsert" } });
        throw error;
      }

      persistUserId(user.id);
      return { userId: user.id };
    }
  });
}
