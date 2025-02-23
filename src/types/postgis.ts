import type { PostgresBinaryType } from "./mod";

export interface Geometry {
  geometryType: number;
  srid: number;
  x: number;
  y: number;
}

export interface Geography {
  geometryType: number;
  latitude: number;
  longitude: number;
  srid: number;
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
    if (buffer.length !== 25) {
      console.log("!!!!!!!!!!", Buffer.from(buffer).toString("hex"));
    }
    const reader = new GeometryReader(buffer);
    const geometryType = reader.readInt32();
    const srid = reader.readSrid();
    switch (geometryType) {
      case 536870913: {
        // single point
        const x = reader.readFloat64();
        const y = reader.readFloat64();
        return { geometryType, srid, x, y };
      }
      case 536870915: {
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
        return { geometryType, srid, points };
      }

      default:
        throw new Error(`Unsupported geometry type: ${geometryType}`);
    }
  },
  encode(value: Geometry) {
    throw new Error("Method not implemented.");
  },
};

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
