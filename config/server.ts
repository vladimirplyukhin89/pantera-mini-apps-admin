import type { Core } from '@strapi/strapi';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/** Node.js http: headersTimeout must be <= requestTimeout (ERR_OUT_OF_RANGE if violated). */
const httpTimeouts = () => {
  const requestTimeout = parsePositiveInt(process.env.UPLOAD_REQUEST_TIMEOUT_MS, 6 * 60 * 1000);
  const headersTimeoutRaw = parsePositiveInt(process.env.UPLOAD_HEADERS_TIMEOUT_MS, 5 * 60 * 1000);
  const keepAliveTimeout = parsePositiveInt(process.env.UPLOAD_KEEP_ALIVE_TIMEOUT_MS, 65 * 1000);
  const headersTimeout = Math.min(headersTimeoutRaw, requestTimeout);
  return { requestTimeout, headersTimeout, keepAliveTimeout };
};

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const { requestTimeout, headersTimeout, keepAliveTimeout } = httpTimeouts();
  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    /** Продакшен: PUBLIC_URL=https://cms.ваш-домен.ru для корректных URL админки и API */
    url: env('PUBLIC_URL', 'http://localhost:1337'),
    http: {
      serverOptions: {
        requestTimeout,
        headersTimeout,
        keepAliveTimeout,
      },
    },
    app: {
      keys: env.array('APP_KEYS'),
    },
  };
};

export default config;
