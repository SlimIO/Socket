// Require Node.js Dependencies
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createServer } from "net";

// Require Third-party Dependencies
import bytes from "bytes";
import Addon from "@slimio/addon";
import Config from "@slimio/config";
import secureJSONParse from "secure-json-parse";

// Node.js constants
const __dirname = dirname(fileURLToPath(import.meta.url));

// Create Socket Addon
const Socket = new Addon("socket")
    .lockOn("gate")
    .lockOn("events");

// CONSTANTS
const NULL_CHAR = "\0".charCodeAt(0);
let BUF_WATERMARK = bytes("32KB");

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
                socket.emit("message", secureJSONParse.parse(str));
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
                error(error) {
                    const msg = {
                        uuid, complete: true, error: String(error)
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

    socket.on("close", () => null);
    socket.on("error", (err) => Socket.logger.writeLine(err.message));
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
        if (server !== null && server.address().port === port) {
            return;
        }

        Socket.logger.writeLine(`assigning port '${port}' to the server`);
        if (server !== null) {
            Socket.logger.writeLine("Reloading tcp server!");
            server.close();
        }
        server = createServer(socketHandler);
        server.listen(port);
        Socket.ready();
    }, (err) => Socket.logger.writeLine(String(err)));

    cfg.observableOf("verbose").subscribe((verbose) => {
        if (Socket.verbose === verbose) {
            return;
        }

        Socket.logger.writeLine(`verbosity updated to: ${verbose}`);
        Socket.verbose = verbose;
    }, (err) => Socket.logger.writeLine(String(err)));

    cfg.observableOf("socketWaterMark").subscribe((value) => {
        const newWaterMark = typeof value === "number" ? value : bytes(value);
        if (BUF_WATERMARK === newWaterMark) {
            return;
        }

        Socket.logger.writeLine(`socket high water mark updated to: ${value}`);
        BUF_WATERMARK = newWaterMark;
    }, (err) => Socket.logger.writeLine(String(err)));
});

Socket.on("sleep", () => {
    if (server !== null) {
        server.close();
    }
    server = null;
});

export default Socket;
