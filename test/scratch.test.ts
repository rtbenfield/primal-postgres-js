import { expect, test } from "vitest";
import { Client } from "../src/mod";
import { NodeSocket } from "../src/socket.node";

expect.addEqualityTesters([
  (a, b) => {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
    } else {
      return false;
    }
  },
]);

test("scratch", async () => {
  const client = new Client({
    connection: "postgresql://user:password@localhost:5432/driver",
    socket: async (hostname, port) => {
      const socket = new NodeSocket(hostname, port);
      await socket.connected;
      return socket;
    },
  });

  const connection = await client.connect();
  const result = await connection.query('SELECT 1, 2 AS "two"');
  console.log("!!!!!!!!", result.columns);
});
