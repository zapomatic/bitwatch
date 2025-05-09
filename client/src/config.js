export const DEFAULT_GAP_LIMIT = 2;
export const DEFAULT_INITIAL_ADDRESSES = 5;
export const DEFAULT_SKIP_ADDRESSES = 0;

export const DEFAULT_CONFIG = {
  api: "https://mempool.space",
  apiParallelLimit: 1,
  interval: 600000,
  apiDelay: 2000,
  debugLogging: false,
};

export const PRIVATE_CONFIG = {
  api: "http://10.21.21.26:3006",
  apiParallelLimit: 100,
  interval: 60000,
  apiDelay: 100,
  debugLogging: false,
};

export const DEFAULT_EXPECTED_BALANCES = {
  chain_in: 0,
  chain_out: 0,
  mempool_in: 0,
  mempool_out: 0,
};

export const ADDRESS_DISPLAY_LENGTH = 8; // Number of characters to show before truncating
export const ADDRESS_COPY_TIMEOUT = 1500; // Time in ms to show "Copied!" message

export const API_DELAY = 1000; // Delay between API calls in ms
export const API_PARALLEL_LIMIT = 5; // Maximum number of parallel API calls

export const NOTIFICATION_DURATION = 3000; // Duration to show notifications in ms
export const COLLAPSE_ANIMATION_DURATION = 300; // Duration of collapse/expand animations in ms

// System monitor settings
export const defaultMonitorSettings = {
  chain_in: "auto-accept",
  chain_out: "alert",
  mempool_in: "auto-accept",
  mempool_out: "alert",
};

// Default form configurations
export const DEFAULT_ADDRESS_FORM = {
  name: "",
  address: "",
  expect: DEFAULT_EXPECTED_BALANCES,
  monitor: defaultMonitorSettings,
};

export const DEFAULT_EXTENDED_KEY_FORM = {
  name: "",
  key: "",
  gapLimit: DEFAULT_GAP_LIMIT,
  initialAddresses: DEFAULT_INITIAL_ADDRESSES,
  derivationPath: "m/0",
  skip: DEFAULT_SKIP_ADDRESSES,
  monitor: defaultMonitorSettings,
};

export const DEFAULT_DESCRIPTOR_FORM = {
  name: "",
  descriptor: "",
  gapLimit: DEFAULT_GAP_LIMIT,
  initialAddresses: DEFAULT_INITIAL_ADDRESSES,
  skip: DEFAULT_SKIP_ADDRESSES,
  monitor: defaultMonitorSettings,
};
