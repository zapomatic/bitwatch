const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  websocket: jest.fn(),
  processing: jest.fn(),
  scan: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  network: jest.fn(),
  data: jest.fn(),
  wsState: jest.fn(),
  mempool: jest.fn(),
  block: jest.fn(),
  transaction: jest.fn(),
  system: jest.fn(),
  telegram: jest.fn(),
};

export default mockLogger;
