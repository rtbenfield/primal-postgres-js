import { BinaryWriter } from "../binary-writer";

export class Query {
  /** 'Q' */
  static readonly CODE = 0x51;

  constructor(public sql: string) {}

  get buffer() {
    const writer = new BinaryWriter(5 + this.sql.length);
    writer.writeByte(Query.CODE);
    writer.writeInt32(4 + this.sql.length + 1);
    writer.writeString(this.sql);
    return writer.buffer;
  }
}
