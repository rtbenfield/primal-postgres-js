import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";
import { PostgresBinaryType } from "./mod";

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

export const BOOL: PostgresBinaryType<boolean> = {
  oid: 16,
  name: "bool",
  decode(buffer) {
    if (buffer.length !== 1) {
      throw new RangeError(`Expected buffer of length 1, got ${buffer.length}`);
    }
    return buffer[0] !== 0;
  },
  encode(value) {
    return new Uint8Array([value ? 1 : 0]);
  },
};

export const BYTEA: PostgresBinaryType<Uint8Array> = {
  oid: 17,
  name: "bytea",
  decode(buffer) {
    return buffer;
  },
  encode(value) {
    return value;
  },
};

export const CHAR: PostgresBinaryType<string> = {
  oid: 18,
  name: "char",
  decode(buffer) {
    return decoder.decode(buffer);
  },
  encode(value) {
    return encoder.encode(value);
  },
};

export const NAME: PostgresBinaryType<string> = {
  oid: 19,
  name: "name",
  decode(buffer) {
    return decoder.decode(buffer);
  },
  encode(value) {
    return encoder.encode(value);
  },
};

export const INT8: PostgresBinaryType<bigint> = {
  oid: 20,
  name: "int8",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getBigInt64(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigInt64(0, BigInt(value), false);
    return new Uint8Array(buffer);
  },
};

export const INT2: PostgresBinaryType<number> = {
  oid: 21,
  name: "int2",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getInt16(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setInt16(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const INT4: PostgresBinaryType<number> = {
  oid: 23,
  name: "int4",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getInt32(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt32(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const REGPROC: PostgresBinaryType<number> = {
  oid: 24,
  name: "regproc",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getUint32(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const TEXT: PostgresBinaryType<string> = {
  oid: 25,
  name: "text",
  decode(buffer) {
    return decoder.decode(buffer);
  },
  encode(value) {
    return encoder.encode(value);
  },
};

export const TID: PostgresBinaryType<TupleIdentifier> = {
  oid: 27,
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
};

export const XID: PostgresBinaryType<number> = {
  oid: 28,
  name: "xid",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getUint32(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const CID: PostgresBinaryType<number> = {
  oid: 29,
  name: "cid",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getUint32(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const OID: PostgresBinaryType<number> = {
  oid: 30,
  name: "oid",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getUint32(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, value, false);
    return new Uint8Array(buffer);
  },
};

export const JSON: PostgresBinaryType<Record<string, unknown>> = {
  oid: 114,
  name: "json",
  decode(buffer) {
    const reader = new BinaryReader(buffer);
    const length = reader.readInt32();
    const value = reader.readBuffer(length);
    const json = decoder.decode(value);
    return globalThis.JSON.parse(json);
  },
  encode(value) {
    const json = globalThis.JSON.stringify(value);
    const writer = new BinaryWriter();
    writer.writeInt32(json.length);
    writer.encodeInto(json);
    return writer.buffer;
  },
};

export const POINT: PostgresBinaryType<Point> = {
  oid: 600,
  name: "point",
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
};

export const LINESEGMENT: PostgresBinaryType<LineSegment> = {
  oid: 601,
  name: "lseg",
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
};

export const PATH: PostgresBinaryType<Path> = {
  oid: 602,
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
};

export const BOX: PostgresBinaryType<Box> = {
  oid: 603,
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
};

export const POLYGON: PostgresBinaryType<Polygon> = {
  oid: 604,
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
};

export const CIRCLE: PostgresBinaryType<Circle> = {
  oid: 718,
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
};

export const MONEY: PostgresBinaryType<bigint> = {
  oid: 790,
  name: "money",
  decode(buffer) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    return view.getBigInt64(0, false);
  },
  encode(value) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigInt64(0, BigInt(value), false);
    return new Uint8Array(buffer);
  },
};

export const MACADDR: PostgresBinaryType<string> = {
  oid: 829,
  name: "macaddr",
  decode(buffer) {
    const reader = new BinaryReader(buffer);
    return Array.from(reader.readBuffer(6), (byte) => byte.toString(16)).join(
      ":",
    );
  },
  encode(value) {
    const writer = new BinaryWriter(6);
    const parts = value.split(":");
    for (const part of parts) {
      writer.writeByte(parseInt(part, 16));
    }
    return writer.buffer;
  },
};

export const RECORD: PostgresBinaryType<unknown> = {
  oid: 2249,
  name: "record",
  decode(buffer, types) {
    const reader = new BinaryReader(buffer);
    const count = reader.readInt32();
    const values = new Array<unknown>(count);
    for (let i = 0; i < count; i++) {
      const oid = reader.readInt32();
      const elementLength = reader.readInt32();
      const elementType = types.getType(oid);
      const value = elementType.decode(reader.readBuffer(elementLength), types);
      values[i] = value;
    }
    return values;
  },
  encode(value) {
    throw new Error("Not implemented");
  },
};

export const PG_LSN: PostgresBinaryType<string> = {
  oid: 2278,
  name: "pg_lsn",
  decode(buffer) {
    throw new Error("Not implemented");
  },
  encode(value) {
    throw new Error("Not implemented");
  },
};

export const RECORD_ARRAY: PostgresBinaryType<unknown> = {
  oid: 2287,
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
      const value = elementType.decode(reader.readBuffer(elementLength), types);
      elements[i] = value;
    }
    return elements;
  },
  encode(value) {
    throw new Error("Not implemented");
  },
};

export const UUID: PostgresBinaryType<`${string}-${string}-${string}-${string}-${string}`> =
  {
    oid: 2950,
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
  };
