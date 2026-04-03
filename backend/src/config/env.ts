import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

export const env = {
  DATABASE_URL: requireEnv('DATABASE_URL'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  COOKIE_SECRET: requireEnv('COOKIE_SECRET'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  PORT: Number(process.env.PORT) || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
