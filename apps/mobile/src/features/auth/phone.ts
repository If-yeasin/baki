import { z } from "zod";

export const bdPhoneSchema = z
  .string()
  .trim()
  .min(1, "auth.validation.phone_required")
  .transform((value) => normalizeBdPhone(value))
  .refine((value) => /^\+8801[3-9]\d{8}$/.test(value), "auth.validation.phone_invalid");

export const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "auth.validation.otp_invalid"),
  phone: bdPhoneSchema
});

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "auth.validation.name_required")
    .max(50, "auth.validation.name_too_long"),
  phone: bdPhoneSchema
});

export type OtpInput = z.infer<typeof otpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

export function normalizeBdPhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.startsWith("01")) {
    return `+880${digits.slice(1)}`;
  }

  if (digits.startsWith("1")) {
    return `+880${digits}`;
  }

  return input.trim();
}

export function displayBdPhone(input: string): string {
  const normalized = normalizeBdPhone(input);
  return normalized.replace(/^\+880(1\d{2})(\d{3})(\d{3})$/, "+880 $1-$2-$3");
}
