const createMockServices = () => {
  const services = {
    mempool: {
      balances: {},
      setAddressBalance: (address, balance) => {
        services.mempool.balances[address] = balance;
      },
      getBalances: () => services.mempool.balances,
      clearBalances: () => {
        services.mempool.balances = {};
      },
      // Mock mempool WebSocket
      websocket: {
        state: "CONNECTED",
        listeners: {},
        on: (event, callback) => {
          if (!services.mempool.websocket.listeners[event]) {
            services.mempool.websocket.listeners[event] = [];
          }
          services.mempool.websocket.listeners[event].push(callback);
        },
        emit: (event, data) => {
          if (services.mempool.websocket.listeners[event]) {
            services.mempool.websocket.listeners[event].forEach((callback) =>
              callback(data)
            );
          }
        },
        setState: (state) => {
          services.mempool.websocket.state = state;
          services.mempool.websocket.emit("state", { state });
        },
      },
    },
    websocket: {
      listeners: {},
      emit: (event, data) => {
        if (services.websocket.listeners[event]) {
          services.websocket.listeners[event].forEach((callback) =>
            callback(data)
          );
        }
      },
      on: (event, callback) => {
        if (!services.websocket.listeners[event]) {
          services.websocket.listeners[event] = [];
        }
        services.websocket.listeners[event].push(callback);
      },
      clearListeners: () => {
        services.websocket.listeners = {};
      },
    },
    telegram: {
      token: null,
      chatId: null,
      messages: [],
      initAttempts: 0,
      init: async (sendTestMessage = false) => {
        services.telegram.initAttempts++;
        if (sendTestMessage) {
          services.telegram.messages.push(
            "✅ Bitwatch Telegram notifications configured successfully!"
          );
        }
        return { success: true };
      },
      sendMessage: async (message) => {
        services.telegram.messages.push(message);
        return true;
      },
      getConfig: () => ({
        token: services.telegram.token,
        chatId: services.telegram.chatId,
      }),
      getInitAttempts: () => services.telegram.initAttempts,
      getMessages: () => services.telegram.messages,
      clearMessages: () => {
        services.telegram.messages = [];
      },
    },
  };
  return services;
};
