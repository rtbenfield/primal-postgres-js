import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";

/**
 * ParseComplete (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARSECOMPLETE PostgreSQL Docs}
 */
export class ParseComplete {
  /** '1' */
  static readonly CODE = 0x31;

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(ParseComplete.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === ParseComplete.CODE,
    //   `Expected '1', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    // console.assert(length === 4, `Expected length 4, got ${length}`);
    return new ParseComplete();
  }
}
