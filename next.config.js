/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  //experimental: { appDir: true },

  
}
// next.config.js
module.exports = {
  i18n: {
    locales: ['en','vi'],
    defaultLocale: 'en'
  }
}
module.exports = {
  env: {
    GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  },
};

module.exports = nextConfig
