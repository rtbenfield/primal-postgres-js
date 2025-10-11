import { BinaryWriter } from "../binary-writer";

/**
 * Flush (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-FLUSH PostgreSQL Docs}
 */
export class Flush {
  /** 'H' */
  static readonly CODE = 0x48;

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Flush.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}
