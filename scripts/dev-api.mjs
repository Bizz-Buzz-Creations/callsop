// Runs the same API handler as the Netlify Function on a local port, for
// development and testing without the Netlify CLI. Vite proxies /api to it.
//   npm run dev:api        (reads MONGODB_URI and SESSION_SECRET from .env)
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handle } from "../netlify/api/routes.js";

const port = Number(process.env.API_PORT || 8788);

createServer(async (incoming, outgoing) => {
  try {
    const url = `http://${incoming.headers.host || "localhost"}${incoming.url}`;
    const hasBody = !["GET", "HEAD"].includes(incoming.method);
    const request = new Request(url, {
      method: incoming.method,
      headers: incoming.headers,
      body: hasBody ? Readable.toWeb(incoming) : undefined,
      duplex: hasBody ? "half" : undefined,
    });
    const response = await handle(request, { ip: incoming.socket.remoteAddress });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    outgoing.writeHead(500, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ error: "Server error." }));
  }
}).listen(port, () => console.log(`API listening on http://localhost:${port}/api`));
