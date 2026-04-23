import type { Core } from '@strapi/strapi';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

type EnvGetter = Core.Config.Shared.ConfigParams['env'];

/**
 * Use Strapi's `env()` (not `process.env` at module load): dotenv does not override
 * existing `process.env` keys, so mixed shell + .file values can break the invariant
 * headersTimeout <= requestTimeout and crash Node (ERR_OUT_OF_RANGE).
 */
const httpTimeouts = (env: EnvGetter) => {
  const requestTimeout = parsePositiveInt(
    env('UPLOAD_REQUEST_TIMEOUT_MS', String(6 * 60 * 1000)),
    6 * 60 * 1000
  );
  const headersTimeoutRaw = parsePositiveInt(
    env('UPLOAD_HEADERS_TIMEOUT_MS', String(5 * 60 * 1000)),
    5 * 60 * 1000
  );
  const keepAliveTimeout = parsePositiveInt(
    env('UPLOAD_KEEP_ALIVE_TIMEOUT_MS', String(65 * 1000)),
    65 * 1000
  );
  const headersTimeout = Math.min(headersTimeoutRaw, requestTimeout);
  return { requestTimeout, headersTimeout, keepAliveTimeout };
};

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const { requestTimeout, headersTimeout, keepAliveTimeout } = httpTimeouts(env);
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
