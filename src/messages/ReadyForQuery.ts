import { BinaryReader } from "../binary-reader";

export class ReadyForQuery {
  /** 'Z' */
  static readonly CODE = 0x5a;

  constructor(public transactionStatus: number) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === ReadyForQuery.CODE,
    //   `Expected 'Z', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    // console.assert(length === 5, `Expected length 5, got ${length}`);
    const transactionStatus = reader.readByte();
    return new ReadyForQuery(transactionStatus);
  }
}
