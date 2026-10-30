import { z } from "zod";
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "Use at most 72 UTF-8 bytes.",
  );
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
});
export const registrationSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number.")
    .refine((v) => {
      const n = v.replace(/\D/g, "").length;
      return n >= 7 && n <= 15;
    }, "Use 7–15 digits."),
  password,
});
