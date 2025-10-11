import { BinaryWriter } from "../binary-writer";

/**
 * Sync (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SYNC PostgreSQL Docs}
 */
export class Sync {
  /** 'S' */
  static readonly CODE = 0x53;

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Sync.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}
