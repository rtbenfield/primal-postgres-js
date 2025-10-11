import { BinaryWriter } from "../binary-writer";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SASLRESPONSE PostgreSQL Docs}
 */
export class SASLResponse {
  constructor(public payload: string) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte("p".charCodeAt(0)); // 'p' code
    writer.writeInt32(4 + this.payload.length);
    writer.encodeInto(this.payload);
    return writer.buffer;
  }
}
