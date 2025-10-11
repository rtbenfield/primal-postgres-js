import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK PostgreSQL Docs}
 */
export class AuthenticationOK {
  /** 'R' */
  static readonly CODE = 0x52;

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === AuthenticationOK.CODE,
    //   `Expected 'R', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    // console.assert(length === 8, `Expected length 8, got ${length}`);
    const tag = reader.readInt32();
    // console.assert(tag === 0, `Expected 0, got ${tag}`);
    return new AuthenticationOK();
  }
}
