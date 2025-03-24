const io = require("socket.io-client");

const socketIO = io(`ws://${window.location.hostname}:3117`, {
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
