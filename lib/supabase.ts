import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && supabaseKey !== 'PLACEHOLDER_KEY';

// Connection state management
let connectionCheckPromise: Promise<boolean> | null = null;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

// Create a single supabase client for interacting with your database
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10, // Rate limiting for realtime events
      },
    },
    global: {
      headers: {
        'x-client-info': 'relief-experts-attendance',
      },
    },
  })
  : null;

/**
 * Check if Supabase is configured
 */
export const checkSupabaseConnection = (): boolean => {
  return !!isConfigured;
};

/**
 * Test connection health with caching to prevent rapid checks
 */
export const testConnectionHealth = async (): Promise<boolean> => {
  if (!isConfigured || !supabase) return false;

  const now = Date.now();

  // Return cached result if within check interval
  if (connectionCheckPromise && now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL) {
    return connectionCheckPromise;
  }

  lastConnectionCheck = now;

  connectionCheckPromise = (async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .select('id')
        .limit(1)
        .single();

      return !error;
    } catch {
      return false;
    }
  })();

  return connectionCheckPromise;
};

/**
 * Subscribe to connection status changes
 */
export const onConnectionChange = (callback: (isConnected: boolean) => void): (() => void) => {
  if (!supabase) {
    callback(false);
    return () => { };
  }

  // Check initial status
  testConnectionHealth().then(callback);

  // Set up periodic health checks
  const intervalId = setInterval(async () => {
    const isHealthy = await testConnectionHealth();
    callback(isHealthy);
  }, CONNECTION_CHECK_INTERVAL);

  return () => {
    clearInterval(intervalId);
  };
};

/**
 * Get realtime channel with optimized settings
 */
export const getOptimizedChannel = (channelName: string) => {
  if (!supabase) return null;

  return supabase.channel(channelName, {
    config: {
      broadcast: {
        self: false, // Don't receive own broadcasts
      },
      presence: {
        key: '', // Disable presence if not needed
      },
    },
  });
};
