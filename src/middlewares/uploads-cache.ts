const DEFAULT_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year

type UploadsCacheConfig = {
  /** Cache-Control max-age in seconds. */
  maxAgeSeconds?: number;
  /** `immutable` is safe: local provider uses `/uploads/{hash}{ext}`. */
  immutable?: boolean;
};

const resolveMaxAge = (config: UploadsCacheConfig): number => {
  if (config.maxAgeSeconds != null && Number.isFinite(config.maxAgeSeconds) && config.maxAgeSeconds > 0) {
    return Math.floor(config.maxAgeSeconds);
  }
  const raw = process.env.UPLOADS_CACHE_MAX_AGE_SECONDS;
  if (raw === undefined || raw === '') {
    return DEFAULT_MAX_AGE_SEC;
  }
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_AGE_SEC;
};

/**
 * After `strapi::public` serves a file, set strong cache headers for media under `/uploads/`.
 * Place this middleware immediately before `strapi::public` in config/middlewares.
 */
export default (config: UploadsCacheConfig = {}) => {
  const maxAgeSeconds = resolveMaxAge(config);
  const immutable = config.immutable !== false;

  return async (ctx, next) => {
    await next();
    if (ctx.status !== 200) {
      return;
    }
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return;
    }
    if (!ctx.path.startsWith('/uploads/')) {
      return;
    }

    const parts = ['public', `max-age=${maxAgeSeconds}`];
    if (immutable) {
      parts.push('immutable');
    }
    ctx.set('Cache-Control', parts.join(', '));
  };
};
