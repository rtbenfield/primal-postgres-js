import { BinaryWriter } from "../binary-writer";

/**
 * Describe (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DESCRIBE PostgreSQL Docs}
 */
export class Describe {
  /** 'D' */
  static readonly CODE = 0x44;

  constructor(
    public type: "S" | "P",
    public name: string,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(this.type.charCodeAt(0));
    writer.writeString(this.name);
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Describe.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }
}
