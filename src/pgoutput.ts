/**
 * @module pgoutput
 *
 * Contains the protocol messages for pgoutput encoding. These messages are
 * contained within XLogData messages transmitted in the replication protocol.
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html PostgreSQL Docs}
 */

import { BinaryReader } from "./binary-reader";

/**
 * Begin
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-BEGIN}
 */
export class Begin {
  static get CODE() {
    // 'B'
    return 0x42 as const;
  }

  constructor(
    /** The final LSN of the transaction. */
    public lsn: bigint,
    /** Commit timestamp of the transaction. */
    public timestamp: bigint,
    /** Xid of the transaction. */
    public xid: number,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Begin.CODE,
      `Expected 'B', got ${String.fromCharCode(code)}`,
    );
    const lsn = reader.readInt64();
    const timestamp = reader.readInt64();
    const xid = reader.readInt32();
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Begin. Expected 0, got ${reader.remaining}`,
    );
    return new Begin(lsn, timestamp, xid);
  }
}

/**
 * Commit
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-COMMIT}
 */
export class Commit {
  static get CODE() {
    // 'C'
    return 0x43 as const;
  }

  constructor(
    public startLsn: bigint,
    public endLsn: bigint,
    public timestamp: bigint,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Commit.CODE,
      `Expected 'C', got ${String.fromCharCode(code)}`,
    );
    reader.readByte(); // unused flags field
    const startLsn = reader.readInt64();
    const endLsn = reader.readInt64();
    const timestamp = reader.readInt64();
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Commit. Expected 0, got ${reader.remaining}`,
    );
    return new Commit(startLsn, endLsn, timestamp);
  }
}

/**
 * Origin
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-ORIGIN}
 */
export class Origin {
  static get CODE() {
    // 'O'
    return 0x4f as const;
  }

  constructor(
    public lsn: bigint,
    public xid: number,
    public name: string,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Origin.CODE,
      `Expected 'O', got ${String.fromCharCode(code)}`,
    );
    const lsn = reader.readInt64();
    const xid = reader.readInt32();
    const nameLength = reader.readInt16();
    const name = reader.readFixedLengthString(nameLength);
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Origin. Expected 0, got ${reader.remaining}`,
    );
    return new Origin(lsn, xid, name);
  }
}

/**
 * Relation
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-RELATION}
 */
export class Relation {
  static get CODE() {
    // 'R'
    return 0x52 as const;
  }

  constructor(
    public oid: number,
    public namespace: string,
    public name: string,
    public replicaIdentity:
      | 0x64 // 'd' default
      | 0x6e // 'n' none
      | 0x66 // 'f' full
      | 0x70, // 'p' primary key
    public columns: Array<{
      key: number;
      name: string;
      type: number;
      typeModifier: number;
    }>,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Relation.CODE,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const oid = reader.readInt32();
    const namespace = reader.readString();
    const name = reader.readString();
    const replicaIdentity = reader.readByte();
    console.assert(
      replicaIdentity === 0x64 ||
        replicaIdentity === 0x6e ||
        replicaIdentity === 0x66 ||
        replicaIdentity === 0x70,
      `Expected 'd', 'n', 'f', or 'p', got ${String.fromCharCode(replicaIdentity)}`,
    );
    const numColums = reader.readInt16();
    const columns = new Array<{
      key: number;
      name: string;
      type: number;
      typeModifier: number;
    }>(numColums);
    for (let i = 0; i < numColums; i++) {
      const key = reader.readByte();
      const name = reader.readString();
      const type = reader.readInt32();
      const typeModifier = reader.readInt32();
      columns[i] = { key, name, type, typeModifier };
    }
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Relation. Expected 0, got ${reader.remaining}`,
    );
    return new Relation(oid, namespace, name, replicaIdentity as any, columns);
  }
}

/**
 * Type
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-TYPE}
 */
export class Type {
  static get CODE() {
    // 'Y'
    return 0x59 as const;
  }

  constructor(
    public id: number,
    public name: string,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Type.CODE,
      `Expected 'Y', got ${String.fromCharCode(code)}`,
    );
    const id = reader.readInt32();
    const nameLength = reader.readInt16();
    const name = reader.readFixedLengthString(nameLength);
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Type. Expected 0, got ${reader.remaining}`,
    );
    return new Type(id, name);
  }
}

/**
 * Insert
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-INSERT}
 */
export class Insert {
  static get CODE() {
    // 'I'
    return 0x49 as const;
  }

  constructor(
    public relationOid: number,
    public tupleData: TupleData,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Insert.CODE,
      `Expected 'I', got ${String.fromCharCode(code)}`,
    );
    const relationOid = reader.readInt32();
    const tupleCode = reader.readByte();
    console.assert(
      tupleCode === 0x4e, // 'N'
      `Expected 'N', got ${String.fromCharCode(tupleCode)}`,
    );
    const tupleData = TupleData.readFrom(reader);
    return new Insert(relationOid, tupleData);
  }
}

/**
 * Update
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-UPDATE}
 */
export class Update {
  static get CODE() {
    // 'U'
    return 0x55 as const;
  }

  constructor(
    public relationOid: number,
    public oldTupleData: TupleData | null,
    public newTupleData: TupleData,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Update.CODE,
      `Expected 'U', got ${String.fromCharCode(code)}`,
    );
    const relationOid = reader.readInt32();
    const tupleDataType = reader.readByte();
    let oldTupleData: TupleData | null = null;
    if (tupleDataType === 0x4b /* 'K' */ || tupleDataType === 0x4f /* 'O' */) {
      oldTupleData = TupleData.readFrom(reader);
      reader.readByte(); // 'N'
    }
    const newTupleData = TupleData.readFrom(reader);
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data in Update. Expected 0, got ${reader.remaining}`,
    );
    return new Update(relationOid, oldTupleData, newTupleData);
  }
}

/**
 * Delete
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-DELETE}
 */
export class Delete {
  static get CODE() {
    // 'D'
    return 0x44 as const;
  }

  constructor(
    public relationOid: number,
    public tupleDataType: 0x4b /* 'K' */ | 0x4f /* 'O' */,
    public tupleData: TupleData,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Delete.CODE,
      `Expected 'D', got ${String.fromCharCode(code)}`,
    );
    const relationOid = reader.readInt32();
    const tupleDataType = reader.readByte();
    console.assert(
      tupleDataType === 0x4b /* 'K' */ || tupleDataType === 0x4f /* 'O' */,
      `Expected 'K' or 'O', got ${String.fromCharCode(tupleDataType)}`,
    );
    const tupleData = TupleData.readFrom(reader);
    return new Delete(relationOid, tupleDataType as any, tupleData);
  }
}

type TupleColumn =
  | { /** 'n' NULL */ type: 0x63; value: null }
  | { /** 'u' TOASTed value */ type: 0x75; value: Uint8Array }
  | { /** 't' text format */ type: 0x74; value: string }
  | { /** 'b' binary format */ type: 0x62; value: Uint8Array };

/**
 * Tuple data is shared by multiple message types. It contains encoded data
 * from operations like insert, update, and delete.
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-logicalrep-message-formats.html#PROTOCOL-LOGICALREP-MESSAGE-FORMATS-TUPLEDATA PostgreSQL Docs}
 */
export class TupleData {
  constructor(public columns: Array<TupleColumn>) {}

  static readFrom(reader: BinaryReader) {
    const numColumns = reader.readInt16();
    const columns = new Array<TupleColumn>(numColumns);
    for (let i = 0; i < numColumns; i++) {
      const format = reader.readByte();
      if (format === 0x6e /* 'n' NULL */) {
        columns[i] = { type: 0x63, value: null };
      } else if (format === 0x75 /* 'u' TOASTed value */) {
        // TODO: what do we do to handle TOAST data?
        const length = reader.readInt32();
        const data = reader.readBuffer(length);
        columns[i] = { type: 0x75, value: data };
      } else if (format === 0x74 /* 't' text format */) {
        const length = reader.readInt32();
        const text = reader.readFixedLengthString(length);
        columns[i] = { type: 0x74, value: text };
      } else if (format === 0x62 /* 'b' binary format */) {
        const length = reader.readInt32();
        const data = reader.readBuffer(length);
        columns[i] = { type: 0x62, value: data };
      } else {
        throw new Error(
          `Unknown tuple format code: ${String.fromCharCode(format)}`,
        );
      }
    }
    return new TupleData(columns);
  }
}
