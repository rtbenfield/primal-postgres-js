import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";

/**
 * CopyData (F & B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COPYDATA PostgreSQL Docs}
 */
export class CopyData {
  /** 'd' */
  static readonly CODE = 0x64;

  constructor(public data: Uint8Array) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(CopyData.CODE);
    writer.writeInt32(4 + this.data.byteLength);
    writer.writeBuffer(this.data);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === CopyData.CODE,
    //   `Expected ${String.fromCharCode(CopyData.CODE)}, got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32(); // length
    const data = reader.readBuffer(length - 4);
    // console.assert(
    //   reader.remaining === 0,
    //   `Invalid remaining data. Expected 0, got ${reader.remaining}`,
    // );
    return new CopyData(data);
  }
}
