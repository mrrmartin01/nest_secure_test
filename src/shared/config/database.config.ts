import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
});

export const databaseConfig = registerAs('database', () => {
  const result = DatabaseEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Database config validation failed:\n${result.error.toString()}`);
  }
  return {
    url: result.data.DATABASE_URL,
  };
});

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
