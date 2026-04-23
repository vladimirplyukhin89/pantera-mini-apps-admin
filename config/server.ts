import type { Core } from '@strapi/strapi';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  /** Продакшен: PUBLIC_URL=https://cms.ваш-домен.ru для корректных URL админки и API */
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  http: {
    serverOptions: {
      requestTimeout: parsePositiveInt(process.env.UPLOAD_REQUEST_TIMEOUT_MS, 5 * 60 * 1000),
      headersTimeout: parsePositiveInt(process.env.UPLOAD_HEADERS_TIMEOUT_MS, 6 * 60 * 1000),
      keepAliveTimeout: parsePositiveInt(process.env.UPLOAD_KEEP_ALIVE_TIMEOUT_MS, 65 * 1000),
    },
  },
  app: {
    keys: env.array('APP_KEYS'),
  },
});

export default config;
