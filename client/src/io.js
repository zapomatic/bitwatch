const io = require("socket.io-client");

// in test mode, we connect to a server running on 3119, in production, it's 3117
const SERVER_PORT = window.location.port === "3120" ? 3119 : 3117;

const socketIO = io(`ws://${window.location.hostname}:${SERVER_PORT}`, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ["websocket"],
  upgrade: false,
});

// Log the connection URL for debugging
console.log(
  `Connecting to WebSocket at ws://${window.location.hostname}:${SERVER_PORT}`
);

socketIO.on("disconnect", (socket) => {
  console.log(`socket disconnect`, socket);
});
window.socketIO = socketIO;

window.addEventListener("beforeunload", function () {
  socketIO.disconnect();
});

export default socketIO;
