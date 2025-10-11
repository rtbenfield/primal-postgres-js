import { BinaryWriter } from "../binary-writer";

/**
 * Execute (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-EXECUTE PostgreSQL Docs}
 */
export class Execute {
  /** 'E' */
  static readonly CODE = 0x45;

  constructor(
    /** The name of the portal to execute (an empty string selects the unnamed portal). */
    public name: string = "",
    /** Maximum number of rows to return, if portal contains a query that returns rows (ignored otherwise). Zero denotes "no limit". */
    public limit: number = 0,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.name);
    writer.writeInt32(this.limit);
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Execute.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }
}
