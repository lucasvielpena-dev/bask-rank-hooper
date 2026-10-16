import type { CapacitorConfig } from '@capacitor/cli';

/**
 * server.url = site na Vercel
 * → o APK é um "shell" e sempre abre a versão mais recente do site.
 * Troque a URL se o domínio da Vercel for outro.
 */
const LIVE_URL = process.env.CAPACITOR_SERVER_URL || 'https://bask-rank-hoops-3.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.rankhooper.app',
  appName: 'Rank Hooper',
  webDir: 'build',
  server: {
    url: LIVE_URL,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: [
      'https://*.vercel.app',
      'https://*.supabase.co',
      'https://rmqloznmfalxhujvwywl.supabase.co',
      'https://accounts.google.com',
      'https://*.google.com',
    ],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0B0F14',
      showSpinner: false,
    },
  },
};

export default config;
