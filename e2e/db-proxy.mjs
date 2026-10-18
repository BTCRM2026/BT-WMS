// TCP proxy between the app and Postgres that tests can switch off and on,
// to simulate the database going down / Railway restarting it.
//   DB traffic:  127.0.0.1:PROXY_PORT -> real Postgres
//   Control:     GET http://127.0.0.1:CONTROL_PORT/{down|up|status}
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";

const PROXY_PORT = Number(process.env.DB_PROXY_PORT ?? 54400);
const CONTROL_PORT = Number(process.env.DB_PROXY_CONTROL_PORT ?? 54401);
const target = new URL(readFileSync(".e2e-db-url", "utf8").trim());
const sockets = new Set();
let up = true;

net
  .createServer((client) => {
    if (!up) return client.destroy();
    const server = net.connect(Number(target.port || 5432), target.hostname);
    for (const s of [client, server]) {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
      s.on("error", () => {});
    }
    client.pipe(server).pipe(client);
    client.on("close", () => server.destroy());
    server.on("close", () => client.destroy());
  })
  .listen(PROXY_PORT, "127.0.0.1");

http
  .createServer((req, res) => {
    if (req.url === "/down") {
      up = false;
      for (const s of sockets) s.destroy(); // drop live connections, like a DB restart
    } else if (req.url === "/up") up = true;
    res.end(JSON.stringify({ up }));
  })
  .listen(CONTROL_PORT, "127.0.0.1", () =>
    console.log(`db proxy :${PROXY_PORT} -> ${target.host}, control :${CONTROL_PORT}`),
  );
