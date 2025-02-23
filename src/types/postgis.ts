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
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const littleEndian = view.getUint8(0) === 0x01;
    const geometryType = view.getUint32(1, littleEndian);
    const srid = view.getUint32(5, littleEndian);
    const x = view.getFloat64(9, littleEndian);
    const y = view.getFloat64(17, littleEndian);
    return { geometryType, srid, x, y };
  },
  encode(value: Geometry) {
    throw new Error("Method not implemented.");
  },
};
