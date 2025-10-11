import { BinaryReader } from "../binary-reader";

export interface FieldDescription {
  fieldName: string;
  relid: number;
  relseq: number;
  oid: number;
  typelen: number;
  typemod: number;
  formatCode: number;
}

/**
 * RowDescription (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ROWDESCRIPTION PostgreSQL Docs}
 */
export class RowDescription {
  /** 'T' */
  static readonly CODE = 0x54;

  constructor(public columns: Array<FieldDescription>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    // console.assert(
    //   code === RowDescription.CODE,
    //   `Expected 'T', got ${String.fromCharCode(code)}`,
    // );
    const length = reader.readInt32();
    const fieldCount = reader.readInt16();
    const fields = new Array<FieldDescription>(fieldCount);
    for (let i = 0; i < fieldCount; i++) {
      const fieldName = reader.readString();
      const relid = reader.readInt32();
      const relseq = reader.readInt16();
      const oid = reader.readInt32();
      const typelen = reader.readInt16();
      const typemod = reader.readInt32();
      const formatCode = reader.readInt16();
      fields[i] = {
        fieldName,
        relid,
        relseq,
        oid,
        typelen,
        typemod,
        formatCode,
      };
    }
    return new RowDescription(fields);
  }
}
