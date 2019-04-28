// Require NodeJS Dependencies
const { createServer } = require("net");

// Require Third-party Dependencies
const Addon = require("@slimio/addon");

// Create Socket Addon
const Socket = new Addon("socket")
    .lockOn("gate")
    .lockOn("events");

/**
 * @function socketHandler
 * @param {NodeJS.Socket} socket socket
 * @returns {void}
 */
function socketHandler(socket) {
    socket.on("data", (buf) => {
        try {
            const { uuid, callback, args } = JSON.parse(buf.toString());
            Socket.sendMessage(callback, { args }).subscribe({
                next(data) {
                    const msg = {
                        uuid, complete: false, data, error: null
                    };
                    socket.write(`${JSON.stringify(msg)}\n`);
                },
                error(err) {
                    const msg = {
                        uuid, complete: true, error: err
                    };
                    socket.write(`${JSON.stringify(msg)}\n`);
                },
                complete() {
                    const msg = {
                        uuid, complete: true, error: null, data: null
                    };
                    socket.write(`${JSON.stringify(msg)}\n`);
                }
            });
        }
        catch (err) {
            console.error(err);
            socket.end();
        }
    });

    socket.on("close", () => {
        // Do nothing
    });
    socket.on("error", (err) => {
        console.error(err);
    });
}

/** @type {Socket.Server} */
let server = null;

Socket.on("awake", () => {
    server = createServer(socketHandler);
    server.listen(1337);
    Socket.ready();
});

Socket.on("stop", () => {
    if (server !== null) {
        server.close();
    }
    server = null;
});

module.exports = Socket;
