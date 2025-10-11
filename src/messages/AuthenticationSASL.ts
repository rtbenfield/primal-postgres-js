import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASL PostgreSQL Docs}
 */
export class AuthenticationSASL {
  constructor(public mechanisms: Set<string>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === 0x52,
    //   `Expected 'R', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    // console.assert(tag === 10, `Expected 10, got ${tag}`);

    const mechanisms = new Set<string>();
    while (reader.remaining > 1) {
      mechanisms.add(reader.readString());
    }
    // console.assert(reader.readByte() === 0x0, "Expected 0x0");
    return new AuthenticationSASL(mechanisms);
  }
}
