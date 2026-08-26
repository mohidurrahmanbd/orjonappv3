export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    url?: string;
    cleartext?: boolean;
  };
}

const config: CapacitorConfig = {
  appId: 'com.orjonmcq.app', // আপনার পছন্দমতো ডোমেইন আইডেন্টিফায়ার
  appName: 'Orjon MCQ',       // আপনার অ্যাপের নাম
  webDir: 'dist-mobile',      // Vite mobile বিল্ড ফোল্ডারের নাম
  server: {
    androidScheme: 'https'
  }
};

export default config;
