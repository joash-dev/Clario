import { config } from "dotenv";
import { z } from "zod";

// Load `.env` before any other module reads `process.env`
config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (s) => s.startsWith("postgresql://") || s.startsWith("postgres://"),
        "DATABASE_URL must be a PostgreSQL connection string"
      ),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
    GEMINI_API_KEY: z.string().optional(),
    /** Stable model id — see https://ai.google.dev/gemini-api/docs/models/gemini */
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  })
  .superRefine((data, ctx) => {
    const openaiKey = (data.OPENAI_API_KEY ?? "").trim();
    const geminiKey = (data.GEMINI_API_KEY ?? "").trim();
    if (data.AI_PROVIDER === "openai" && openaiKey.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENAI_API_KEY is required when AI_PROVIDER is openai",
        path: ["OPENAI_API_KEY"],
      });
    }
    if (data.AI_PROVIDER === "gemini" && geminiKey.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GEMINI_API_KEY is required when AI_PROVIDER is gemini",
        path: ["GEMINI_API_KEY"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    OPENAI_API_KEY: (data.OPENAI_API_KEY ?? "").trim() || undefined,
    GEMINI_API_KEY: (data.GEMINI_API_KEY ?? "").trim() || undefined,
  }));

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
