import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DATAROW PostgreSQL Docs}
 */
export class DataRow {
  /** 'D' */
  static readonly CODE = 0x44;

  constructor(public columns: ReadonlyArray<Uint8Array | null>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === DataRow.CODE,
    //   `Expected 'D', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const columnCount = reader.readInt16();
    const columns = new Array<Uint8Array | null>(columnCount);
    for (let i = 0; i < columnCount; i++) {
      const columnLength = reader.readInt32();
      if (columnLength === -1) {
        columns[i] = null;
      } else {
        columns[i] = reader.readBuffer(columnLength);
      }
    }
    return new DataRow(columns);
  }
}
