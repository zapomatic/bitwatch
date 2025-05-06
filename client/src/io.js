import io from "socket.io-client";

// in test mode, we connect to a server running on 3119, in production, it's 3117
const SERVER_PORT = window.location.port === "3120" ? 3119 : 3117;
const SERVER_HOST = window.location.hostname;
const SERVER_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";

const socketIO = io(`${SERVER_PROTOCOL}//${SERVER_HOST}:${SERVER_PORT}`, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ["websocket"],
  upgrade: false,
});

// Log the connection URL for debugging
console.log(
  `Connecting to WebSocket at ${SERVER_PROTOCOL}//${SERVER_HOST}:${SERVER_PORT}`
);

socketIO.on("disconnect", (socket) => {
  console.log(`socket disconnect`, socket);
});
window.socketIO = socketIO;

window.addEventListener("beforeunload", function () {
  socketIO.disconnect();
});

export default socketIO;
