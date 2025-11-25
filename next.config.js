/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  //experimental: { appDir: true },

  webpack: (config) => {
    config.ignoreWarnings = [
      // Tắt cảnh báo của face-api
      {
        module: /node_modules[\\/]@vladmandic[\\/]face-api/,
        message: /Critical dependency/,
      },
     
      {
        module: /node_modules/,
        message: /Failed to parse source map/,
      },
    ];
    return config;
  },

  output: 'standalone', 
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
