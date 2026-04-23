import type { Core } from '@strapi/strapi';

const UPLOAD_MAX_FILE_SIZE_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 10);
const UPLOAD_MAX_FILE_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            '://airtable.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            '://airtable.com',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: `${UPLOAD_MAX_FILE_SIZE_MB}mb`,
      jsonLimit: `${UPLOAD_MAX_FILE_SIZE_MB}mb`,
      textLimit: `${UPLOAD_MAX_FILE_SIZE_MB}mb`,
      formidable: {
        maxFileSize: UPLOAD_MAX_FILE_SIZE_BYTES,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
