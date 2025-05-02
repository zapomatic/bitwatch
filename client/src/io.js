const io = require("socket.io-client");

// Use environment variable for server port, fallback to 3117
const SERVER_PORT = process.env.SERVER_PORT || 3119;

const socketIO = io(`ws://${window.location.hostname}:${SERVER_PORT}`, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  transports: ["websocket"],
  upgrade: false,
});

socketIO.on("disconnect", (socket) => {
  console.log(`socket disconnect`, socket);
});
window.socketIO = socketIO;

window.addEventListener("beforeunload", function () {
  socketIO.disconnect();
});

export default socketIO;
