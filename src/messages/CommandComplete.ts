import { BinaryReader } from "../binary-reader";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COMMANDCOMPLETE PostgreSQL Docs}
 */
export class CommandComplete {
  /** 'C' */
  static readonly CODE = 0x43;

  constructor(public commandTag: string) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === CommandComplete.CODE,
    //   `Expected 'C', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const commandTag = reader.readString();
    return new CommandComplete(commandTag);
  }
}
