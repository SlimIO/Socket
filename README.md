# Socket
Built-in Socket Addon. This addon create a TCP/IP Socket server that will listen on `1337` (by default).

## Getting Started
This package is available in the SlimIO Package Registry and can be easily installed with [SlimIO CLI](https://github.com/SlimIO/CLI).

```bash
$ slimio --add socket
# or
$ slimio --add https://github.com/SlimIO/Socket
```

> Note: this addon is automatically installed with the slimio -i command.

## Notes
To be able to communicate with the product externally, please use the official [Tcp-SDK](https://github.com/SlimIO/Tcp-Sdk) package.

```js
const TcpSdk = require("@slimio/tcp-sdk");

async function main() {
    const client = new TcpSdk();
    await client.once("connect", 1000);

    const info = await client.sendOne("cpu.get_info");
    console.log(info);

    client.close();
}
main().catch(console.error);
```

## Dependencies

|Name|Refactoring|Security Risk|Usage|
|---|---|---|---|
|[@slimio/addon](https://github.com/SlimIO/Addon#readme)|Minor|Low|Addon Container|
|[@slimio/config](https://github.com/SlimIO/Config#readme)|Minor|Medium|Configuration loader|

## License
MIT
