import { expect, test } from "vitest";
import { Client, Connection, PreparedStatement, QueryResult } from "../src/mod";
import { NodeSocket } from "../src/socket.node";
import { defaultBinaryTypeParser } from "../src/types/built-ins";

expect.addEqualityTesters([
  (a, b) => {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
    } else {
      return undefined;
    }
  },
]);

test("simple connection", async () => {
  const client = createClient();

  await using connection = await client.connect();
  expect(connection).toBeInstanceOf(Connection);
});

test("simple query", async () => {
  const client = createClient();
  await using connection = await client.connect();

  const results = await connection.query("SELECT 1 UNION ALL SELECT 2");
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
});

test("prepared statement", async () => {
  const client = createClient();
  await using connection = await client.connect();

  const statement = await connection.prepare(
    `SELECT $1::INT AS "my_field_name" UNION ALL SELECT $2::INT`,
  );
  expect(statement).toBeInstanceOf(PreparedStatement);

  const results = await statement.execute([1, 2]).then((r) => r.toArray());
  expect(results).toEqual([{ my_field_name: 1 }, { my_field_name: 2 }]);
});

test("prepared statement cancel", async () => {
  const client = createClient();
  await using connection = await client.connect();

  const statement = await connection.prepare(
    `SELECT $1::INT AS "my_field_name" UNION ALL SELECT $2::INT`,
  );
  expect(statement).toBeInstanceOf(PreparedStatement);

  // using will cancel the statement
  await using result = await statement.execute([1, 2]);
  expect(result).toBeInstanceOf(QueryResult);
});

test("do tuples work", async () => {
  const client = createClient();
  await using connection = await client.connect();

  const statement = await connection.prepare(
    `SELECT
      gen_random_uuid()::TEXT AS "id",
      ROW(gen_random_uuid()::TEXT, 1) AS "nested"
    FROM generate_series(1, 3)`,
  );
  expect(statement).toBeInstanceOf(PreparedStatement);

  // using will cancel the statement
  const result = await statement.execute([]);
  expect(result).toBeInstanceOf(QueryResult);

  const results = await result.toArray();
  expect(results).toEqual([
    {
      id: expect.any(String),
      nested: [expect.any(String), expect.any(Number)],
    },
    {
      id: expect.any(String),
      nested: [expect.any(String), expect.any(Number)],
    },
    {
      id: expect.any(String),
      nested: [expect.any(String), expect.any(Number)],
    },
  ]);
});

test("do arrays of tuple work", async () => {
  const client = createClient();
  await using connection = await client.connect();

  const statement = await connection.prepare(
    `SELECT
      gen_random_uuid() AS "id",
      gen_random_uuid()::TEXT AS "text",
      ARRAY(SELECT ROW(
        gen_random_uuid(),
        gen_random_uuid()::TEXT,
        1)
        FROM generate_series(1, 3)) AS "nested"
    FROM generate_series(1, 3)`,
  );
  expect(statement).toBeInstanceOf(PreparedStatement);

  // using will cancel the statement
  const result = await statement.execute([]);
  expect(result).toBeInstanceOf(QueryResult);

  const results = await result.toArray();
  expect(results).toEqual([
    {
      id: expect.any(String),
      text: expect.any(String),
      nested: [
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
      ],
    },
    {
      id: expect.any(String),
      text: expect.any(String),
      nested: [
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
      ],
    },
    {
      id: expect.any(String),
      text: expect.any(String),
      nested: [
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
        [expect.any(String), expect.any(String), expect.any(Number)],
      ],
    },
  ]);
});

function createClient() {
  return new Client({
    connection: "postgresql://user:password@localhost:5432/driver",
    socket: async (hostname, port) => {
      const socket = new NodeSocket(hostname, port);
      await socket.connected;
      return socket;
    },
    types: defaultBinaryTypeParser,
  });
}
