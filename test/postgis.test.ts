import { expect, test } from "vitest";
import { Client, Connection } from "../src/mod";
import { NodeSocket } from "../src/socket.node";
import * as BUILTINS from "../src/types/built-ins";
import { BinaryTypeParser } from "../src/types/mod";
import * as POSTGIS from "../src/types/postgis";

const typeParser = new BinaryTypeParser();
for (const type of Object.values(BUILTINS)) {
  typeParser.register(type);
}
for (const type of Object.values(POSTGIS)) {
  typeParser.register(type);
}

expect.addEqualityTesters([
  (a, b) => {
    if (a instanceof Uint8Array && b instanceof Uint8Array) {
      return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
    } else {
      return undefined;
    }
  },
]);

const client = new Client({
  connection: "postgresql://user:password@localhost:5433/driver",
  socket: async (hostname, port) => {
    const socket = new NodeSocket(hostname, port);
    await socket.connected;
    return socket;
  },
  types: typeParser,
});

test("data types are available", async () => {
  await using connection = await client.connect();
  expect(connection).toBeInstanceOf(Connection);

  const prepared = await connection.prepare(`SELECT
  t.oid,
  t.typname
FROM pg_type t
JOIN pg_depend d ON d.objid = t.oid
JOIN pg_extension e ON e.oid = d.refobjid
WHERE e.extname = 'postgis';`);
  await using result = await prepared.execute([]);
  await expect(result.toArray()).resolves.toMatchInlineSnapshot(`
    [
      {
        "oid": 18052,
        "typname": "spheroid",
      },
      {
        "oid": 18055,
        "typname": "_spheroid",
      },
      {
        "oid": 18056,
        "typname": "geometry",
      },
      {
        "oid": 18064,
        "typname": "_geometry",
      },
      {
        "oid": 18083,
        "typname": "box3d",
      },
      {
        "oid": 18086,
        "typname": "_box3d",
      },
      {
        "oid": 18087,
        "typname": "box2d",
      },
      {
        "oid": 18090,
        "typname": "_box2d",
      },
      {
        "oid": 18091,
        "typname": "box2df",
      },
      {
        "oid": 18094,
        "typname": "_box2df",
      },
      {
        "oid": 18095,
        "typname": "gidx",
      },
      {
        "oid": 18098,
        "typname": "_gidx",
      },
      {
        "oid": 18367,
        "typname": "geometry_dump",
      },
      {
        "oid": 18366,
        "typname": "_geometry_dump",
      },
      {
        "oid": 18374,
        "typname": "spatial_ref_sys",
      },
      {
        "oid": 18373,
        "typname": "_spatial_ref_sys",
      },
      {
        "oid": 18490,
        "typname": "valid_detail",
      },
      {
        "oid": 18489,
        "typname": "_valid_detail",
      },
      {
        "oid": 18754,
        "typname": "geography",
      },
      {
        "oid": 18760,
        "typname": "_geography",
      },
      {
        "oid": 18778,
        "typname": "geography_columns",
      },
      {
        "oid": 18777,
        "typname": "_geography_columns",
      },
      {
        "oid": 18929,
        "typname": "geometry_columns",
      },
      {
        "oid": 18928,
        "typname": "_geometry_columns",
      },
    ]
  `);
});

test.each([
  {
    text: "SRID=4326;POINT(-71.060316 48.432044)",
    expected: {
      geometryType: 536870913,
      srid: 4326,
      longitude: -71.060316,
      latitude: 48.432044,
    },
  },
])("geography decoding - %#", async ({ expected, text }) => {
  await using connection = await client.connect();
  expect(connection).toBeInstanceOf(Connection);

  const prepared = await connection.prepare(
    `SELECT ST_GeogFromText($1) AS actual`,
  );
  await using result = await prepared.execute([text]);
  await expect(result.toArray()).resolves.toEqual([{ actual: expected }]);
});

test.each([
  {
    text: "POINT(-71.060316 48.432044)",
    expected: {
      geometryType: "Point",
      srid: 4326,
      x: -71.060316,
      y: 48.432044,
    },
  },
  {
    text: "POLYGON((-71.060316 48.432044, -71.060316 48.5, -71.0 48.5, -71.0 48.432044, -71.060316 48.432044))",
    expected: {
      geometryType: "Polygon",
      srid: 4326,
      points: [
        { x: -71.060316, y: 48.432044 },
        { x: -71.060316, y: 48.5 },
        { x: -71.0, y: 48.5 },
        { x: -71.0, y: 48.432044 },
      ],
    },
  },
])("geometry decoding - %#", async ({ expected, text }) => {
  await using connection = await client.connect();
  expect(connection).toBeInstanceOf(Connection);

  const prepared = await connection.prepare(
    `SELECT ST_GeomFromText($1, 4326) AS actual`,
  );
  await using result = await prepared.execute([text]);
  await expect(result.toArray()).resolves.toEqual([{ actual: expected }]);
});
