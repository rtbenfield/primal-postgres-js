import { beforeAll, expect, test } from "vitest";
import { PgoutputDecoderStream } from "../src/logical-replication";
import { Client, PreparedStatement, QueryResult } from "../src/mod";
import { NodeSocket } from "../src/socket.node";
import { defaultBinaryTypeParser } from "../src/types/built-ins";

const client = new Client({
  connection: "postgresql://user:password@localhost:5432/driver",
  socket: async (hostname, port) => {
    const socket = new NodeSocket(hostname, port);
    await socket.connected;
    return socket;
  },
  // logger: new ConsoleLogger("debug"),
  types: defaultBinaryTypeParser,
});

const replication = new Client({
  connection: {
    database: "driver",
    hostname: "localhost",
    password: "password",
    port: 5432,
    replication: "database",
    username: "user",
  },
  socket: async (hostname, port) => {
    const socket = new NodeSocket(hostname, port);
    await socket.connected;
    return socket;
  },
  // logger: new ConsoleLogger("debug"),
  types: defaultBinaryTypeParser,
});

beforeAll(async () => {
  await using connection = await client.connect();
  connection
    .query(
      `SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots`,
    )
    .then((x) => x.cancel())
    .catch(() => {});
});

test("scratch logical replication testing", async () => {
  const id = crypto.randomUUID().replaceAll("-", "");

  await using _publication = await createPublication(id);
  await using _slot = await createReplicationSlot(id);

  const count = 100;
  const randomData = await makeRandomDataFeed(false);
  const data = await randomData.createData(count);
  await randomData.updateData();
  await randomData.deleteData();

  await using connection = await replication.connect();
  const { readable } = await connection.send(
    `START_REPLICATION SLOT "${id}" LOGICAL 0/0
      (proto_version '1', publication_names '${id}', binary)`,
  );
  const reader = readable
    .pipeThrough(new PgoutputDecoderStream(defaultBinaryTypeParser))
    .getReader();

  for (const row of data) {
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: expect.objectContaining({
        type: "insert",
        inserted: row,
      }),
    });
  }
  for (const row of data) {
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: expect.objectContaining({
        type: "update",
        before: null,
        after: {
          id: row.id,
          text: expect.any(String),
        },
      }),
    });
  }
  for (const row of data) {
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: expect.objectContaining({
        type: "delete",
        deleted: {
          id: row.id,
          text: null,
        },
      }),
    });
  }
});

async function createPublication(name: string): Promise<AsyncDisposable> {
  await using connection = await client.connect();
  const prepared = await connection.prepare(
    `CREATE PUBLICATION "${name}" FOR ALL TABLES`,
  );
  expect(prepared).toBeInstanceOf(PreparedStatement);

  await using result = await prepared.execute([]);
  expect(result).toBeInstanceOf(QueryResult);

  return {
    async [Symbol.asyncDispose]() {
      await dropPublication(name);
    },
  };
}

async function createReplicationSlot(name: string) {
  await using connection = await client.connect();
  const prepared = await connection.prepare(
    `SELECT slot_name FROM pg_create_logical_replication_slot($1, 'pgoutput')`,
  );
  expect(prepared).toBeInstanceOf(PreparedStatement);

  await using result = await prepared.execute([name]);
  expect(result).toBeInstanceOf(QueryResult);

  const slot = await result.first();
  expect(slot).toEqual({ slot_name: name });

  return {
    async [Symbol.asyncDispose]() {
      await dropReplicationSlot(name);
    },
    slot,
  };
}

async function dropPublication(name: string) {
  await using connection = await client.connect();
  const prepared = await connection.prepare(`DROP PUBLICATION "${name}"`);
  expect(prepared).toBeInstanceOf(PreparedStatement);

  await using result = await prepared.execute([]);
  expect(result).toBeInstanceOf(QueryResult);
}

async function dropReplicationSlot(name: string) {
  await using connection = await client.connect();
  const prepared = await connection.prepare(
    `SELECT * FROM pg_drop_replication_slot($1)`,
  );
  expect(prepared).toBeInstanceOf(PreparedStatement);

  await using result = await prepared.execute([name]);
  expect(result).toBeInstanceOf(QueryResult);
  // await result.toArray();
}

async function makeRandomDataFeed(withReplicaIdentityFull = false) {
  const name = `Table_${crypto.randomUUID().replaceAll("-", "")}`;
  await using connection = await client.connect();
  await connection.query(
    `CREATE TABLE "${name}" (id UUID PRIMARY KEY, text TEXT NOT NULL)`,
  );

  if (withReplicaIdentityFull) {
    await using connection = await client.connect();
    await connection.query(`ALTER TABLE "${name}" REPLICA IDENTITY FULL`);
  }

  return {
    get name() {
      return name;
    },
    async createData(count = 1) {
      await using connection = await client.connect();
      const prepared = await connection.prepare(
        `INSERT INTO "${name}" (id, text)
          SELECT gen_random_uuid(), gen_random_uuid()::TEXT FROM generate_series(1, $1)
          RETURNING id, text`,
      );
      const result = await prepared.execute([count]);
      return result.toArray() as Promise<Array<{ id: string; text: string }>>;
    },
    async deleteData() {
      await using connection = await client.connect();
      const prepared = await connection.prepare(`DELETE FROM "${name}"`);
      await using _result = await prepared.execute([]);
    },
    async updateData() {
      await using connection = await client.connect();
      const prepared = await connection.prepare(
        `UPDATE "${name}" SET text = gen_random_uuid()::TEXT`,
      );
      await using _result = await prepared.execute([]);
    },
    async [Symbol.asyncDispose]() {
      await connection.query(`DROP TABLE "${name}"`);
      await Promise.all([connection.close()]);
    },
  };
}
