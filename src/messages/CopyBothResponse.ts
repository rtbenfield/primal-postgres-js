import { BinaryReader } from "../binary-reader";

/**
 * CopyBothResponse (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COPYBOTHRESPONSE PostgreSQL Docs}
 */
export class CopyBothResponse {
  /** 'W' */
  static readonly CODE = 0x57;

  constructor(
    public formatCode: number,
    public columnFormats: number[],
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === CopyBothResponse.CODE,
    //   `Expected ${String.fromCharCode(CopyBothResponse.CODE)}, got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32(); // length
    // console.assert(length === 7, `Expected length 4, got ${length}`);
    const formatCode = reader.readByte();
    const numCols = reader.readInt16();
    const columnFormats = new Array<number>(numCols);
    for (let i = 0; i < numCols; i++) {
      columnFormats[i] = reader.readInt16();
    }
    return new CopyBothResponse(formatCode, columnFormats);
  }
}
