import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedIssues = parsedEnv.error.issues.map((issue) => {
    const field = issue.path.join('.') || 'unknown';
    return `- ${field}: ${issue.message}`;
  });

  throw new Error(
    `Variáveis de ambiente inválidas ou ausentes:\n${formattedIssues.join('\n')}`,
  );
}

export const env = parsedEnv.data;
