import type { PostgresBinaryType } from "./mod";

export type Geometry =
  | {
      geometryType: "Point";
      srid: number | null;
      x: number;
      y: number;
    }
  | {
      geometryType: "Polygon";
      srid: number | null;
      points: Array<{ x: number; y: number }>;
    };

export interface Geography {
  geometryType: number;
  latitude: number;
  longitude: number;
  srid: number | null;
}

export const GEOGRAPHY: PostgresBinaryType<Geography> = {
  oid: 18754,
  name: "geography",
  decode(buffer: Uint8Array) {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const littleEndian = view.getUint8(0) === 0x01;
    const geometryType = view.getUint32(1, littleEndian);
    const srid = view.getUint32(5, littleEndian);
    const longitude = view.getFloat64(9, littleEndian);
    const latitude = view.getFloat64(17, littleEndian);
    return { geometryType, latitude, longitude, srid };
  },
  encode(value: Geography) {
    throw new Error("Method not implemented.");
  },
};

export const GEOMETRY: PostgresBinaryType<Geometry> = {
  oid: 18056,
  name: "geometry",
  decode(buffer: Uint8Array) {
    console.log("!!!!!!!!!!", Buffer.from(buffer).toString("hex"));
    const reader = new GeometryReader(buffer);
    const geometryType = reader.readGeometryType();
    const srid = geometryType.hasSRID ? reader.readSrid() : null;
    switch (geometryType.type) {
      case 1: {
        // single point
        const x = reader.readFloat64();
        const y = reader.readFloat64();
        return { geometryType: "Point", srid, x, y };
      }
      case 3: {
        // polygon
        reader.readInt32(); // ? 0x01 0x00 0x00 0x00
        const numPoints = reader.readInt32();
        // ? why 1 less than the number of specified points
        const points = new Array(numPoints - 1);
        for (let i = 0; i < points.length; i++) {
          const x = reader.readFloat64();
          const y = reader.readFloat64();
          points[i] = { x, y };
        }
        // ? closing data ex. 0x3c 0xdb 0xa3 0x37 0xdc 0xc3 0x05
        return { geometryType: "Polygon", srid, points };
      }
      default:
        throw new Error(`Unsupported geometry type: ${geometryType}`);
    }
  },
  encode(value: Geometry) {
    throw new Error("Method not implemented.");
  },
};

/**
 * Utility for reading a geometry from a Uint8Array buffer.
 *
 * Geometry is encoded with a different endianness than the rest of the
 * protocol. The endianness is encoded in the buffer as the first byte.
 * `GeometryReader` reads the first byte automatically and applies the
 * endianness to the remaining read operations.
 */
class GeometryReader {
  #position = 0;
  readonly #littleEndian: boolean;
  readonly #view: DataView;

  constructor(buffer: Uint8Array) {
    this.#view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    this.#littleEndian = this.readByte() === 0x01;
  }

  readByte() {
    const value = this.#view.getUint8(this.#position);
    this.#position++;
    return value;
  }

  readGeometryType() {
    const value = this.readInt32();
    return decodeGeometryType(value);
  }

  readInt32() {
    const value = this.#view.getUint32(this.#position, this.#littleEndian);
    this.#position += 4;
    return value;
  }

  readFloat64() {
    const value = this.#view.getFloat64(this.#position, this.#littleEndian);
    this.#position += 8;
    return value;
  }

  readSrid() {
    const value = this.readInt32();
    return value;
  }
}

interface GeometryTypeInfo {
  /** Base geometry type (1=Point, 2=LineString, 3=Polygon, etc.) */
  type: number;
  /** Whether Z coordinates are present */
  hasZ: boolean;
  /** Whether M coordinates (measures) are present */
  hasM: boolean;
  /** Whether SRID is included */
  hasSRID: boolean;
}

/**
 * Decodes a PostGIS geometry type value into its component parts
 * @param geometryType The 32-bit integer representing the geometry type
 * @returns An object containing the decoded type information
 */
function decodeGeometryType(geometryType: number): GeometryTypeInfo {
  // Base type is stored in the lower 4 bits (bits 0-3)
  const type = geometryType & 0x0f;

  // Z flag is bit 4 (or bit position 16 in a 32-bit integer)
  const hasZ = !!(geometryType & 0x80000000);

  // M flag is bit 5 (or bit position 32 in a 32-bit integer)
  const hasM = !!(geometryType & 0x40000000);

  // SRID flag is bit 6 (or bit position 64 in a 32-bit integer)
  const hasSRID = !!(geometryType & 0x20000000);

  return {
    type,
    hasZ,
    hasM,
    hasSRID,
  };
}

const types = Object.freeze(
  new Map([
    [1, "Point" as const],
    [2, "LineString" as const],
    [3, "Polygon" as const],
    [4, "MultiPoint" as const],
    [5, "MultiLineString" as const],
    [6, "MultiPolygon" as const],
    [7, "GeometryCollection" as const],
    [8, "CircularString" as const],
    [9, "CompoundCurve" as const],
    [10, "CurvePolygon" as const],
  ]),
);

/**
 * Returns a human-readable name for a geometry type number
 * @param type The base geometry type number (1-10)
 * @returns A string representation of the geometry type
 */
function getGeometryTypeName(type: number) {
  return types.get(type) ?? `Unknown(${type})`;
}
