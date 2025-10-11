import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";

/**
 * BindComplete (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BINDCOMPLETE PostgreSQL Docs}
 */
export class BindComplete {
  /** '2' */
  static readonly CODE = 0x32;

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(BindComplete.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === BindComplete.CODE,
    //   `Expected '2', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    // console.assert(length === 4, `Expected length 4, got ${length}`);
    return new BindComplete();
  }
}
