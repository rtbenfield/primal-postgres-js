import { BinaryReader } from "../binary-reader";
import { BinaryWriter } from "../binary-writer";

/**
 * Parse (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARSECOMPLETE PostgreSQL Docs}
 */
export class Parse {
  /** 'P' */
  static readonly CODE = 0x50;

  constructor(
    /** The name of the destination prepared statement (an empty string selects the unnamed prepared statement). */
    public name: string,
    /** The query string to be parsed.  */
    public query: string,
    public paramTypes: number[],
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.name);
    writer.writeString(this.query);
    writer.writeInt16(this.paramTypes.length);
    for (const paramType of this.paramTypes) {
      writer.writeInt32(paramType);
    }
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Parse.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === Parse.CODE,
    //   `Expected 'P', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const name = reader.readString();
    const query = reader.readString();
    const numParamTypes = reader.readInt16();
    const paramTypes = new Array<number>(numParamTypes);
    for (let i = 0; i < numParamTypes; i++) {
      paramTypes[i] = reader.readInt32();
    }
    return new Parse(name, query, paramTypes);
  }
}
