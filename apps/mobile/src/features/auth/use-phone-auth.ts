import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import { normalizeBdPhone } from "./phone";

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
      const normalizedPhone = normalizeBdPhone(phone);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: "sms"
      });

      if (error) {
        throw error;
      }

      return data;
    }
  });
}

export function useUpsertProfile() {
  return useMutation({
    mutationFn: async ({ displayName, phone }: UpsertProfileInput) => {
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
        throw error;
      }

      return { userId: user.id };
    }
  });
}
