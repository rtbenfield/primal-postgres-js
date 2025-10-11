import { BinaryWriter } from "../binary-writer";

/**
 * Terminate (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-TERMINATE PostgreSQL Docs}
 */
export class Terminate {
  /** 'X' */
  static readonly CODE = 0x58;

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Terminate.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}
