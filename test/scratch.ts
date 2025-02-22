import { Client } from "../src/mod";
import { NodeSocket } from "../src/socket.node";
import { defaultBinaryTypeParser } from "../src/types/defaults";

async function main() {
  const client = new Client({
    connection: "postgresql://user:password@localhost:5432/driver",
    socket: async (hostname, port) => {
      const socket = new NodeSocket(hostname, port);
      await socket.connected;
      return socket;
    },
    types: defaultBinaryTypeParser,
  });
  await using connection = await client.connect();

  const statement = await connection.prepare(
    `SELECT gen_random_uuid() FROM generate_series(1, 10000)`,
  );
  const results = await statement.execute([]);
  const rows = await results.toArray();
  console.log("done", rows.length);
}

main();
