// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-13',
  devtools: { enabled: true },
  devServer: {
    port: 3000,
  },
  css: ['~/assets/css/tailwind.css'],
  modules: ['@element-plus/nuxt', '@pinia/nuxt', [
    '@nuxtjs/i18n',
    {
      locales: [
        { code: 'zh-TW', iso: 'zh-TW', name: '繁體中文', file: 'zh-TW.json' },
        { code: 'en', iso: 'en', name: 'English', file: 'en.json' },
        { code: 'ja', iso: 'ja-JP', name: '日本語', file: 'ja.json' },
      ],
      lazy: true,
      langDir: 'locales/',
      defaultLocale: 'zh-TW',
      strategy: 'prefix_except_default',
    },
  ], '@nuxt/ui'],
  runtimeConfig: { 
    public: {
      apiBase: 'http://localhost:3001',
      verificationCooldownSeconds: 60
    }
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/_breakpoints.scss" as *;',
        }
      }
    }
  }
})