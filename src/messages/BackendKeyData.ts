import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA PostgreSQL Docs}
 */
export class BackendKeyData {
  /** 'B' */
  static readonly CODE = 0x4b;

  constructor(
    public pid: number,
    public secretKey: number,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === BackendKeyData.CODE,
    //   `Expected 'B', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    // console.assert(length === 12, `Expected length 12, got ${length}`);
    const pid = reader.readInt32();
    const secretKey = reader.readInt32();
    return new BackendKeyData(pid, secretKey);
  }
}
