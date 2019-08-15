"use strict";

// Require NodeJS Dependencies
const { createServer } = require("net");

// Require Third-party Dependencies
const Addon = require("@slimio/addon");

// Create Socket Addon
const Socket = new Addon("socket", { verbose: true })
    .lockOn("gate")
    .lockOn("events");

// CONSTANTS
const NULL_CHAR = "\0".charCodeAt(0);
const BUF_WATERMARK = 32 * 1024;

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
            offset = index + 1;

            const str = Buffer.concat([...tempBuf, buf.slice(offset, index)]).toString();
            tempBuf = [];

            try {
                socket.emit("message", JSON.parse(str));
            }
            catch (err) {
                Socket.logger.writeLine(`failed to parse JSON:\n${str}`);
            }
        }

        if (offset < buf.length) {
            tempBuf.push(buf.slice(offset));
            const len = tempBuf.reduce((prev, curr) => prev + curr.length, 0);
            if (len > BUF_WATERMARK) {
                tempBuf = [];
                socket.end();
            }
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
                    socket.write(`${JSON.stringify(msg)}\0`);
                },
                error(err) {
                    const msg = {
                        uuid, complete: true, error: err.message
                    };
                    socket.write(`${JSON.stringify(msg)}\0`);
                },
                complete() {
                    const msg = {
                        uuid, complete: true, error: null, data: null
                    };
                    socket.write(`${JSON.stringify(msg)}\0`);
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
