"use strict";

// Require Node.js Dependencies
const { join } = require("path");
const { createServer } = require("net");

// Require Third-party Dependencies
const Addon = require("@slimio/addon");
const Config = require("@slimio/config");

// Create Socket Addon
const Socket = new Addon("socket")
    .lockOn("gate")
    .lockOn("events");

// CONSTANTS
const NULL_CHAR = "\0".charCodeAt(0);
let BUF_WATERMARK = 32 * 1024;

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

            const str = Buffer.concat(tempBuf).toString();
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

Socket.on("awake", async() => {
    const cfg = new Config(join(__dirname, "config.json"), {
        autoReload: true,
        createOnNoEntry: true
    });
    await cfg.read();

    cfg.observableOf("port").subscribe((port) => {
        if (server !== null) {
            server.close();
        }
        server = createServer(socketHandler);
        server.listen(port);
        Socket.ready();
    }, (err) => Socket.logger.writeLine(String(err)));

    cfg.observableOf("verbose").subscribe((verbose) => {
        Socket.verbose = verbose;
    }, (err) => Socket.logger.writeLine(String(err)));

    cfg.observableOf("socketWaterMark").subscribe((watermark) => {
        BUF_WATERMARK = watermark;
    }, (err) => Socket.logger.writeLine(String(err)));
});

Socket.on("sleep", () => {
    if (server !== null) {
        server.close();
    }
    server = null;
});

module.exports = Socket;
