import socketIO from "../io/index.js";

export default (state) => {
  socketIO.io.emit("updateState", state);
};
