const getTimestamp = () => new Date().toISOString();

const formatMessage = (message) => {
  return `[${getTimestamp()}] ${message}`;
};

const logger = {
  // General purpose logging
  info: (message) => console.log(formatMessage(`ℹ️  ${message}`)),
  success: (message) => console.log(formatMessage(`✅ ${message}`)),
  warning: (message) => console.warn(formatMessage(`🚨 ${message}`)),
  error: (message) => console.error(formatMessage(`❌ ${message}`)),
  debug: (message) => console.debug(formatMessage(`🔍 ${message}`)),

  // Network and API related
  network: (message) => console.log(formatMessage(`🌐 ${message}`)),
  data: (message) => console.log(formatMessage(`📊 ${message}`)),

  // WebSocket related
  websocket: (message) => console.log(formatMessage(`🔌 ${message}`)),
  wsState: (message) => console.log(formatMessage(`🔄 ${message}`)),

  // Mempool related
  mempool: (message) => console.log(formatMessage(`📝 ${message}`)),
  block: (message) => console.log(formatMessage(`📦 ${message}`)),
  transaction: (message) => console.log(formatMessage(`💸 ${message}`)),

  // System related
  system: (message) => console.log(formatMessage(`🚀 ${message}`)),
  telegram: (message) => console.log(formatMessage(`📱 ${message}`)),

  // Data processing
  processing: (message) => console.log(formatMessage(`💽 ${message}`)),
  scan: (message) => console.log(formatMessage(`🔍 ${message}`)),
};

export default logger;
