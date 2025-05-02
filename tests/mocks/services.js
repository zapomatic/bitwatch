import testData from '../../test-data/keys.json' with { type: 'json' };

export const createMockTelegramBot = () => {
  const messages = [];

  return {
    messages,
    sendMessage: (chatId, message) => {
      messages.push({ chatId, message });
      return { ok: true };
    },
    clearMessages: () => {
      messages.length = 0;
    },
  };
};

export const createMockMempoolAPI = () => {
  const addressBalances = new Map();

  return {
    setAddressBalance: (address, balance) => {
      addressBalances.set(address, {
        chain_stats: {
          funded_txo_sum: balance.chain_in || 0,
          spent_txo_sum: balance.chain_out || 0,
        },
        mempool_stats: {
          funded_txo_sum: balance.mempool_in || 0,
          spent_txo_sum: balance.mempool_out || 0,
        },
      });
    },
    getAddressBalance: (address) => addressBalances.get(address),
    clearBalances: () => addressBalances.clear(),
  };
};

export const createMockWebSocket = () => {
  const listeners = new Map();

  return {
    emit: (event, data) => {
      const handlers = listeners.get(event) || [];
      handlers.forEach((handler) => handler(data));
    },
    on: (event, handler) => {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    },
    clearListeners: () => listeners.clear(),
  };
};
