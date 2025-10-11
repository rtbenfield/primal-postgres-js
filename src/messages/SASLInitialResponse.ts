import { BinaryWriter } from "../binary-writer";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SASLINITIALRESPONSE PostgreSQL Docs}
 */
export class SASLInitialResponse {
  constructor(
    public mechanism: string,
    public payload?: string,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.mechanism);
    if (typeof this.payload === "string") {
      writer.writeInt32(this.payload.length);
      writer.encodeInto(this.payload);
    } else {
      writer.writeInt32(-1);
    }

    // length
    writer.unshift(
      new BinaryWriter(4).writeInt32(4 + writer.byteLength).buffer,
    );

    // 'p' code
    writer.unshift(new Uint8Array(["p".charCodeAt(0)]));

    return writer.buffer;
  }
}
