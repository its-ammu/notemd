export default {
  expo: {
    name: 'NoteMD',
    slug: 'notemd-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    scheme: 'notemd',
    ios: { supportsTablet: false, bundleIdentifier: 'com.notemd.mobile' },
    android: {
      adaptiveIcon: { backgroundColor: '#5167F4' },
      package: 'com.notemd.mobile',
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL ?? 'https://your-project-ref.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? 'your-anon-key',
    },
  },
};
