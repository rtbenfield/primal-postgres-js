import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARAMETERSTATUS PostgreSQL Docs}
 */
export class ParameterStatus {
  /** 'S' */
  static readonly CODE = 0x53;

  constructor(
    public parameter: string,
    public value: string,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === ParameterStatus.CODE,
    //   `Expected 'S', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const parameter = reader.readString();
    const value = reader.readString();
    return new ParameterStatus(parameter, value);
  }
}
