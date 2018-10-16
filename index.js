// Require NodeJS Dependencies
const { createServer } = require("net");

// Require Third-party Dependencies
const Addon = require("@slimio/addon");

// Create Socket Addon
const Socket = new Addon("socket");

/**
 * @functionsocketHandler
 * @param {NodeJS.Socket} socket socket
 * @returns {void}
 */
function socketHandler(socket) {

    socket.on("data", (buf) => {
        console.log(buf);
    });
}

/** @type {Socket.Server} */
let server = null;

Socket.on("start", () => {
    server = createServer(socketHandler);
    server.listen(1337);
});

Socket.on("stop", () => {
    if (server !== null) {
        server.close();
    }
    server = null;
});

module.exports = Socket;
