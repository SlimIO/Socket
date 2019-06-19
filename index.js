// Require NodeJS Dependencies
const { createServer } = require("net");

// Require Third-party Dependencies
const Addon = require("@slimio/addon");

// Create Socket Addon
const Socket = new Addon("socket")
    .lockOn("gate")
    .lockOn("events");

// CONSTANTS
const NULL_CHAR = "\0".charCodeAt(0);

/**
 * @function socketHandler
 * @param {NodeJS.Socket} socket socket
 * @returns {void}
 */
function socketHandler(socket) {
    let tempBuf = [];

    socket.on("data", (buf) => {
        let offset = 0;
        let index;

        while ((index = buf.indexOf(NULL_CHAR, offset)) !== -1) {
            tempBuf.push(buf.slice(offset, index));
            offset = index + 1;

            const len = tempBuf.reduce((prev, curr) => prev + curr.length, 0);
            const str = Buffer.concat(tempBuf, len).toString();
            tempBuf = [];

            try {
                socket.emit("message", JSON.parse(str));
            }
            catch (err) {
                console.log("failed to parse JSON:\n", str);
            }
        }

        if (offset < buf.length) {
            tempBuf.push(buf.slice(offset));
        }
    });

    socket.on("message", (json) => {
        try {
            const { uuid, callback, args } = json;
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
