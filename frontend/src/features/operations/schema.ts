import { z } from "zod";
export type Property = {
  type?: string;
  enum?: unknown[];
  items?: Property;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
  pattern?: string;
  uniqueItems?: boolean;
  maxItems?: number;
};
export type Contract = {
  properties: Record<string, Property>;
  required?: string[];
};
export function contractSchema(contract: Contract) {
  const shape: Record<string, z.ZodType> = {};
  for (const [name, p] of Object.entries(contract.properties)) {
    let v: z.ZodType;
    if (p.type === "boolean") v = z.boolean();
    else if (p.type === "array")
      v = z
        .array(
          z
            .string()
            .refine(
              (value) => !p.items?.enum || p.items.enum.includes(value),
              "Choose a supported permission.",
            ),
        )
        .max(p.maxItems ?? 100)
        .refine(
          (a) => !p.uniqueItems || new Set(a).size === a.length,
          "Choose each option once.",
        );
    else if (p.type === "integer" || p.type === "number")
      v = z.coerce
        .number()
        .min(p.minimum ?? -Infinity)
        .max(p.maximum ?? Infinity)
        .refine(
          (n) => p.type !== "integer" || Number.isInteger(n),
          "Use a whole number.",
        );
    else {
      let text = name === "password" ? z.string() : z.string().trim();
      if (p.minLength) text = text.min(p.minLength);
      if (p.maxLength) text = text.max(p.maxLength);
      if (p.pattern)
        text = text.regex(new RegExp(p.pattern), "Check this value.");
      if (p.format === "email") text = text.email("Enter a valid email.");
      v = text;
      if (name === "phone")
        v = text.refine((s) => {
          const n = s.replace(/\D/g, "").length;
          return n >= 7 && n <= 15;
        }, "Use 7–15 digits.");
      if (name === "password")
        v = text.refine(
          (s) => new TextEncoder().encode(s).length <= 72,
          "Password must be at most 72 UTF-8 bytes.",
        );
      if (p.format === "date-time")
        v = text.refine(
          (s) => Number.isFinite(Date.parse(s)),
          "Enter a date and time including timezone.",
        );
    }
    if (p.enum)
      v = v.refine(
        (value) => p.enum!.includes(value),
        "Choose a supported value.",
      );
    if (!contract.required?.includes(name))
      v = z.preprocess(
        (value) => (value === "" ? undefined : value),
        v.optional(),
      );
    shape[name] = v;
  }
  return z.object(shape).strict();
}
