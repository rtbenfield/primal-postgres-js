import { BinaryReader } from "../binary-reader";

export class ParameterDescription {
  /** 't' */
  static readonly CODE = 0x74;

  constructor(public parameterTypes: ReadonlyArray<number>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === ParameterDescription.CODE,
    //   `Expected 't', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const numParams = reader.readInt16();
    const paramTypes = new Array<number>(numParams);
    for (let i = 0; i < numParams; i++) {
      paramTypes[i] = reader.readInt32();
    }
    return new ParameterDescription(paramTypes);
  }
}
