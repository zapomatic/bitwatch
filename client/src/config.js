export const DEFAULT_GAP_LIMIT = 2;
export const DEFAULT_INITIAL_ADDRESSES = 5;
export const DEFAULT_SKIP_ADDRESSES = 0;

// Monitoring settings
export const DEFAULT_MONITOR_SETTINGS = {
  chain_in: "auto-accept",
  chain_out: "alert",
  mempool_in: "auto-accept",
  mempool_out: "alert",
};

// Expected balance defaults
export const DEFAULT_EXPECTED_BALANCES = {
  chain_in: 0,
  chain_out: 0,
  mempool_in: 0,
  mempool_out: 0,
};

// Address display settings
export const ADDRESS_DISPLAY_LENGTH = 8; // Number of characters to show before truncating
export const ADDRESS_COPY_TIMEOUT = 1500; // Time in ms to show "Copied!" message

// API settings
export const API_DELAY = 1000; // Delay between API calls in ms
export const API_PARALLEL_LIMIT = 5; // Maximum number of parallel API calls

// UI settings
export const NOTIFICATION_DURATION = 3000; // Duration to show notifications in ms
export const COLLAPSE_ANIMATION_DURATION = 300; // Duration of collapse/expand animations in ms
