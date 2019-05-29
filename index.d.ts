/// <reference types="@types/node" />

import * as net from "net";

declare namespace Socket {
    type Server = net.Server;
}
export as namespace Socket;
export = Socket;
