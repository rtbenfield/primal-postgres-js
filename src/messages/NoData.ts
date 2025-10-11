import { BinaryReader } from "../binary-reader";

/**
 * NoData (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-NODATA PostgreSQL Docs}
 */
export class NoData {
  /** 'n' */
  static readonly CODE = 0x6e;

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const length = reader.readInt32(); // length
    // console.assert(length === 4, `Expected length 4, got ${length}`);
  }
}
