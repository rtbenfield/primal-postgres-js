import { BinaryReader } from "../binary-reader";

const decoder = new TextDecoder();

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASLFINAL PostgreSQL Docs}
 */
export class AuthenticationSASLFinal {
  constructor(public payload: string) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === 0x52,
    //   `Expected 'R', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    // console.assert(tag === 12, `Expected 12, got ${tag}`);
    // console.assert(
    //   reader.remaining === length - 8,
    //   `Invalid length of remaining data. Expected ${length - 8}, got ${
    //     reader.remaining
    //   }`,
    // );
    const data = decoder.decode(reader.rest);
    return new AuthenticationSASLFinal(data);
  }
}
