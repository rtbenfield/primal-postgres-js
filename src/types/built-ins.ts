import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";
import { BinaryTypeParser, PostgresBinaryType } from "./mod";

const decoder = new TextDecoder();

/** Precomputed mapping of bytes to thei hex values. */
const BYTES_TO_HEX = Object.freeze(
  Array.from({ length: 0xff }, (_, i) => i.toString(16).padStart(2, "0")),
);

/**
 * Represents a tuple identifier data type in the Postgres protocol.
 * A tuple identifier uniquely identifies a row within a relation.
 */
export interface TupleIdentifier {
  /** 16-byte block number. */
  blockNumber: number;
  /** 16-byte offset of the row within the block. */
  tupleOffset: number;
  /** 16-byte item pointer. */
  itemPointer: number;
}

/**
 * Represents a point data type in the Postgres protocol.
 * A point is a pair of 8-byte floating point coordinates.
 */
export interface Point {
  /** 8-byte floating point coordinate. */
  x: number;
  /** 8-byte floating point coordinate. */
  y: number;
}

/**
 * Represents a box data type in the Postgres protocol.
 * A box is a tuple of 8-byte floating point coordinates.
 */
export interface Box {
  /** 8-byte floating point coordinate. */
  x1: number;
  /** 8-byte floating point coordinate. */
  y1: number;
  /** 8-byte floating point coordinate. */
  x2: number;
  /** 8-byte floating point coordinate. */
  y2: number;
}

/**
 * Represents a circle data type in the Postgres protocol.
 * A circle is a tuple of 8-byte floating point coordinates and an 8-byte radius.
 */
export interface Circle {
  /** 8-byte floating point coordinate. */
  x: number;
  /** 8-byte floating point coordinate. */
  y: number;
  /** 8-byte floating point coordinate. */
  r: number;
}

/**
 * Represents a line segment data type in the Postgres protocol.
 * A line segment is a tuple of 8-byte floating point coordinates.
 */
export interface LineSegment {
  /** 8-byte floating point coordinate. */
  x1: number;
  /** 8-byte floating point coordinate. */
  y1: number;
  /** 8-byte floating point coordinate. */
  x2: number;
  /** 8-byte floating point coordinate. */
  y2: number;
}

/**
 * Represents a path data type in the Postgres protocol.
 * A path is an array of points.
 */
export type Path = Array<Point>;

/**
 * Represents a polygon data type in the Postgres protocol.
 * A polygon is an array of points representing a closed path
 */
export type Polygon = Array<Point>;

const encoder = new TextEncoder();
export const BUILTINS = Object.freeze(
  new Map<number, PostgresBinaryType<unknown>>([
    [
      16,
      {
        name: "bool",
        decode(buffer) {
          if (buffer.length !== 1) {
            throw new RangeError(
              `Expected buffer of length 1, got ${buffer.length}`,
            );
          }
          return buffer[0] === 0x00;
        },
        encode(value) {
          return new Uint8Array([value ? 0x01 : 0x00]);
        },
      } satisfies PostgresBinaryType<boolean>,
    ],
    [
      17,
      {
        name: "bytea",
        decode(buffer) {
          return buffer;
        },
        encode(value) {
          return value;
        },
      } satisfies PostgresBinaryType<Uint8Array>,
    ],
    [
      18,
      {
        name: "char",
        decode(buffer) {
          if (buffer.length !== 1) {
            throw new RangeError(
              `Expected buffer of length 1, got ${buffer.length}`,
            );
          }
          return String.fromCharCode(buffer[0]!);
        },
        encode(value) {
          if (value.length !== 1) {
            throw new RangeError(
              `Expected value of length 1, got ${value.length}`,
            );
          }
          return new Uint8Array([value.charCodeAt(0)]);
        },
      } satisfies PostgresBinaryType<string>,
    ],
    [
      19,
      {
        name: "name",
        decode(buffer) {
          if (buffer.byteLength >= 128) {
            throw new RangeError(
              `Identifier must be less than 64 characters, got ${buffer.byteLength} bytes`,
            );
          }
          return decoder.decode(buffer);
        },
        encode(value) {
          if (value.length > 64) {
            throw new RangeError(
              `Identifier must be less than 64 characters, got ${value.length}`,
            );
          }
          return encoder.encode(value);
        },
      } satisfies PostgresBinaryType<string>,
    ],
    [
      20,
      {
        name: "int8", // 64-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readInt64();
        },
        encode(value) {
          return new BinaryWriter().writeInt64(value).buffer;
        },
      } satisfies PostgresBinaryType<bigint>,
    ],
    [
      21,
      {
        name: "int2", // 16-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readInt16();
        },
        encode(value) {
          return new BinaryWriter().writeInt16(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      23,
      {
        name: "int4", // 32-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readInt32();
        },
        encode(value) {
          return new BinaryWriter().writeInt32(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      24,
      {
        name: "regproc",
        decode(buffer) {
          return new BinaryReader(buffer).readOid();
        },
        encode(value) {
          return new BinaryWriter().writeOid(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      25,
      {
        name: "text",
        decode(buffer) {
          return decoder.decode(buffer);
        },
        encode(value) {
          // just in case the value is coerced to a string
          const stringified = value.toString();
          return encoder.encode(stringified);
        },
      } satisfies PostgresBinaryType<string>,
    ],
    [
      26,
      {
        name: "bool",
        decode(buffer) {
          throw new Error("Method not implemented.");
          // return new BinaryReader(buffer).readBool();
        },
        encode(value) {
          throw new Error("Method not implemented.");
          // return new BinaryWriter().writeBool(value).buffer;
        },
      } satisfies PostgresBinaryType<boolean>,
    ],
    [
      27,
      {
        name: "tid",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const blockNumber = reader.readInt16();
          const tupleOffset = reader.readInt16();
          const itemPointer = reader.readInt16();
          return { blockNumber, tupleOffset, itemPointer };
        },
        encode(value) {
          const writer = new BinaryWriter();
          writer.writeInt16(value.blockNumber);
          writer.writeInt16(value.tupleOffset);
          writer.writeInt16(value.itemPointer);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<TupleIdentifier>,
    ],
    [
      28,
      {
        name: "xid", // 32-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readInt32();
        },
        encode(value) {
          return new BinaryWriter().writeInt32(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      29,
      {
        name: "cid", // 32-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readInt32();
        },
        encode(value) {
          return new BinaryWriter().writeInt32(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      30,
      {
        name: "oid", // 32-bit integer
        decode(buffer) {
          return new BinaryReader(buffer).readOid();
        },
        encode(value) {
          return new BinaryWriter().writeOid(value).buffer;
        },
      } satisfies PostgresBinaryType<number>,
    ],
    [
      114,
      {
        // encoded as text, but without a null-terminator
        name: "json",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const length = reader.readInt32();
          const value = reader.readBuffer(length);
          const json = decoder.decode(value);
          return JSON.parse(json);
        },
        encode(value) {
          const json = JSON.stringify(value);
          const writer = new BinaryWriter();
          writer.writeInt32(json.length);
          writer.encodeInto(json);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Record<string, unknown>>,
    ],
    // [
    //   142,
    //   {
    //     name: "xml",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    [
      600,
      {
        name: "point", // two 8-byte floating point values
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const x = reader.readFloat64();
          const y = reader.readFloat64();
          return { x, y };
        },
        encode(value) {
          const writer = new BinaryWriter();
          writer.writeFloat64(value.x);
          writer.writeFloat64(value.y);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Point>,
    ],
    [
      601,
      {
        name: "lseg", // line segment, two points
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const x1 = reader.readFloat64();
          const y1 = reader.readFloat64();
          const x2 = reader.readFloat64();
          const y2 = reader.readFloat64();
          return { x1, y1, x2, y2 };
        },
        encode(value) {
          const writer = new BinaryWriter();
          writer.writeFloat64(value.x1);
          writer.writeFloat64(value.y1);
          writer.writeFloat64(value.x2);
          writer.writeFloat64(value.y2);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<LineSegment>,
    ],
    [
      602,
      {
        name: "path",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const count = reader.readInt32();
          const points = new Array<Point>(count);
          for (let i = 0; i < count; i++) {
            const x = reader.readFloat64();
            const y = reader.readFloat64();
            points[i] = { x, y };
          }
          return points;
        },
        encode(value) {
          const writer = new BinaryWriter(4 + value.length * 16);
          writer.writeInt32(value.length);
          for (const { x, y } of value) {
            writer.writeFloat64(x);
            writer.writeFloat64(y);
          }
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Path>,
    ],
    [
      603,
      {
        name: "box",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const x1 = reader.readFloat64();
          const y1 = reader.readFloat64();
          const x2 = reader.readFloat64();
          const y2 = reader.readFloat64();
          return { x1, y1, x2, y2 };
        },
        encode(value) {
          const writer = new BinaryWriter();
          writer.writeFloat64(value.x1);
          writer.writeFloat64(value.y1);
          writer.writeFloat64(value.x2);
          writer.writeFloat64(value.y2);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Box>,
    ],
    [
      604,
      {
        name: "polygon",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const count = reader.readInt32();
          const points = new Array<Point>(count);
          for (let i = 0; i < count; i++) {
            const x = reader.readFloat64();
            const y = reader.readFloat64();
            points[i] = { x, y };
          }
          return points;
        },
        encode(value) {
          const writer = new BinaryWriter(4 + value.length * 16);
          writer.writeInt32(value.length);
          for (const { x, y } of value) {
            writer.writeFloat64(x);
            writer.writeFloat64(y);
          }
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Polygon>,
    ],
    [
      718,
      {
        name: "circle",
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const x = reader.readFloat64();
          const y = reader.readFloat64();
          const r = reader.readFloat64();
          return { x, y, r };
        },
        encode(value) {
          const writer = new BinaryWriter(24);
          writer.writeFloat64(value.x);
          writer.writeFloat64(value.y);
          writer.writeFloat64(value.r);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<Circle>,
    ],
    [
      790,
      {
        name: "money", // 64-bit integer representing the smallest unit of currency
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          const value = reader.readInt64();
          return value;
        },
        encode(value) {
          const writer = new BinaryWriter(8);
          writer.writeInt64(value);
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<bigint>,
    ],
    [
      829,
      {
        name: "macaddr", // 6-byte MAC address
        decode(buffer) {
          const reader = new BinaryReader(buffer);
          return Array.from(reader.readBuffer(6), (byte) =>
            byte.toString(16),
          ).join(":");
        },
        encode(value) {
          const writer = new BinaryWriter(6);
          const parts = value.split(":");
          for (const part of parts) {
            writer.writeByte(parseInt(part, 16));
          }
          return writer.buffer;
        },
      } satisfies PostgresBinaryType<string>,
    ],
    // [
    //   869,
    //   {
    //     name: "inet",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   650,
    //   {
    //     name: "cidr",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   700,
    //   {
    //     name: "float4",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   701,
    //   {
    //     name: "float8",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1700,
    //   {
    //     name: "numeric",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1114,
    //   {
    //     name: "timestamp",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1184,
    //   {
    //     name: "timestamptz",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1082,
    //   {
    //     name: "date",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1083,
    //   {
    //     name: "time",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1266,
    //   {
    //     name: "timetz",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1186,
    //   {
    //     name: "interval",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    [
      2249,
      {
        name: "record",
        decode(buffer, types) {
          const reader = new BinaryReader(buffer);
          const count = reader.readInt32();
          const values = new Array<unknown>(count);
          for (let i = 0; i < count; i++) {
            const oid = reader.readInt32();
            const elementLength = reader.readInt32();
            const elementType = types.getType(oid);
            const value = elementType.decode(
              reader.readBuffer(elementLength),
              types,
            );
            values[i] = value;
          }
          return values;
        },
        encode(value) {
          throw new Error("Not implemented");
        },
      } satisfies PostgresBinaryType<unknown>,
    ],
    [
      2278,
      {
        name: "pg_lsn",
        decode(buffer) {
          console.log("!!!!!!!!!!!!!1", buffer);
          throw new Error("Not implemented");
        },
        encode(value) {
          throw new Error("Not implemented");
        },
      } satisfies PostgresBinaryType<string>,
    ],
    [
      2287,
      {
        // array of tuples
        name: "_record",
        decode(buffer, types) {
          const reader = new BinaryReader(buffer);
          reader.readInt32(); //?
          reader.readInt32(); //?
          const elementOID = reader.readInt32();
          const elementType = types.getType(elementOID);
          const elementCount = reader.readInt32();
          const elements = new Array<unknown>(elementCount);
          reader.readInt32(); //?
          for (let i = 0; i < elementCount; i++) {
            const elementLength = reader.readInt32();
            const value = elementType.decode(
              reader.readBuffer(elementLength),
              types,
            );
            elements[i] = value;
          }
          return elements;
        },
        encode(value) {
          throw new Error("Not implemented");
        },
      } satisfies PostgresBinaryType<unknown>,
    ],
    [
      2950,
      {
        name: "uuid",
        decode(buffer) {
          let uuid = "";
          for (let i = 0; i < 16; i++) {
            let hexValue = BYTES_TO_HEX[buffer[i]!]!;
            uuid += hexValue;
            if (i === 3 || i === 5 || i === 7 || i === 9) {
              uuid += "-";
            }
          }
          return uuid as any;
        },
        encode(value) {
          const byteArray = new Uint8Array(16);
          let byteIndex = 0;
          for (let i = 0; i < value.length; i++) {
            if (value[i] !== "-") {
              byteArray[byteIndex] = parseInt(value.substring(i, 2), 16);
              byteIndex++;
              i++; // Increment i to skip the next character as well
            }
          }
          return byteArray;
        },
      } satisfies PostgresBinaryType<`${string}-${string}-${string}-${string}-${string}`>,
    ],
    // [
    //   3802,
    //   {
    //     name: "jsonb",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1043,
    //   {
    //     name: "varchar",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
    // [
    //   1042,
    //   {
    //     name: "char(n)",
    //     decode(buffer) {},
    //     encode(value) {},
    //   } satisfies PostgresBinaryType<boolean>,
    // ],
  ]),
);

export const defaultBinaryTypeParser = new BinaryTypeParser().register(
  BUILTINS.entries(),
);
