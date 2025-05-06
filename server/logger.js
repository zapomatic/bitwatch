import memory from "./memory.js";

const getTimestamp = () => new Date().toISOString();

const formatMessage = (message) => {
  return `[${getTimestamp()}] ${message}`;
};

const logger = {
  // General purpose logging
  info: (message) => {
    console.log(`[${new Date().toISOString()}] ℹ️  ${message}`);
  },
  success: (message) => {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`);
  },
  warning: (message) => {
    console.log(`[${new Date().toISOString()}] ⚠️  ${message}`);
  },
  error: (message, cb) => {
    console.log(`[${new Date().toISOString()}] ❌ ${message}`);
    cb && cb({ success: false, error: message });
  },
  debug: (message) => {
    if (memory.db.debugLogging) {
      console.log(`[${new Date().toISOString()}] 🔍 ${message}`);
    }
  },

  // Network and API related
  network: (message) => {
    console.log(`[${new Date().toISOString()}] 🌐 ${message}`);
  },
  data: (message) => console.log(formatMessage(`📊 ${message}`)),

  // WebSocket related
  websocket: (message) => {
    console.log(`[${new Date().toISOString()}] 🔌 ${message}`);
  },
  wsState: (message) => console.log(formatMessage(`🔄 ${message}`)),

  // Mempool related
  mempool: (message) => {
    console.log(`[${new Date().toISOString()}] 💭 ${message}`);
  },
  block: (message) => {
    console.log(`[${new Date().toISOString()}] 🧊 ${message}`);
  },
  transaction: (message) => console.log(formatMessage(`💸 ${message}`)),

  // System related
  system: (message) => console.log(formatMessage(`🚀 ${message}`)),
  telegram: (message) => console.log(formatMessage(`📱 ${message}`)),

  // Data processing
  processing: (message) => {
    console.log(`[${new Date().toISOString()}] ⚙️  ${message}`);
  },
  scan: (message) => {
    console.log(`[${new Date().toISOString()}] 🔄 ${message}`);
  },
};

export default logger;
