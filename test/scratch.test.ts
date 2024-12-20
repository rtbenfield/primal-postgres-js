import { expect, test } from "vitest";
import { Client } from "../src/mod";
import { NodeSocket } from "../src/socket.node";

expect.addEqualityTesters([
  (a, b) => {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
    } else {
      return undefined;
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

  // {
  //   const results = await connection.query("SELECT 1 UNION ALL SELECT 2");
  //   const resultsReader = results.getReader();
  //   await expect(resultsReader.read()).resolves.toEqual({
  //     done: false,
  //     value: expect.anything(),
  //   });
  //   await expect(resultsReader.read()).resolves.toEqual({
  //     done: false,
  //     value: expect.anything(),
  //   });
  //   await expect(resultsReader.read()).resolves.toEqual({
  //     done: true,
  //     value: undefined,
  //   });
  // }

  {
    console.log("------------------------------");
    const results = await connection.query2("SELECT $1 UNION ALL SELECT $2", [
      "1",
      "2",
    ]);
    const resultsReader = results.getReader();
    await expect(resultsReader.read()).resolves.toEqual({
      done: false,
      value: expect.anything(),
    });
    await expect(resultsReader.read()).resolves.toEqual({
      done: false,
      value: expect.anything(),
    });
    await expect(resultsReader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  }
});
