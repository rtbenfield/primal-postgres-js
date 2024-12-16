import { BinaryReader } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ERRORRESPONSE PostgreSQL Docs}
 */
export class ErrorResponse {
  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    const length = reader.readInt32();
    // TODO: parse fields from https://www.postgresql.org/docs/current/protocol-error-fields.html
    const tempFieldMap = new Map<string, string>();
    while (reader.remaining > 0) {
      const fieldType = reader.readByte();
      const value = reader.readString();
      tempFieldMap.set(String.fromCharCode(fieldType), value);
    }
    return { code, tempFieldMap };
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK PostgreSQL Docs}
 */
export class AuthenticationOK {
  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 0, `Expected 0, got ${tag}`);
    return new AuthenticationOK();
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASL PostgreSQL Docs}
 */
export class AuthenticationSASL {
  constructor(public mechanisms: Set<string>) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 10, `Expected 10, got ${tag}`);

    const mechanisms = new Set<string>();
    while (reader.remaining > 1) {
      mechanisms.add(reader.readString());
    }
    console.assert(reader.readByte() === 0x0, "Expected 0x0");
    return new AuthenticationSASL(mechanisms);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/17/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASLCONTINUE PostgreSQL Docs}
 */
export class AuthenticationSASLContinue {
  constructor(public payload: string) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 11, `Expected 11, got ${tag}`);
    const data = decoder.decode(new Uint8Array(reader.rest));
    return new AuthenticationSASLContinue(data);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASLFINAL PostgreSQL Docs}
 */
export class AuthenticationSASLFinal {
  constructor(public payload: string) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 12, `Expected 12, got ${tag}`);
    const data = decoder.decode(new Uint8Array(reader.rest));
    return new AuthenticationSASLFinal(data);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA PostgreSQL Docs}
 */
export class BackendKeyData {
  constructor(public pid: number, public secretKey: number) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x4b,
      `Expected 'B', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    console.assert(length === 12, `Expected length 12, got ${length}`);
    const pid = reader.readInt32();
    const secretKey = reader.readInt32();
    return new BackendKeyData(pid, secretKey);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARAMETERSTATUS PostgreSQL Docs}
 */
export class ParameterStatus {
  constructor(public parameter: string, public value: string) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x53,
      `Expected 'S', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const parameter = reader.readString();
    const value = reader.readString();
    return new ParameterStatus(parameter, value);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE PostgreSQL Docs}
 */
export function StartupMessage(options: {
  user: string;
  database?: string;
  /** @default false */
  replication?: true | false | "database";
}): Uint8Array {
  const writer = new BinaryWriter();

  // protocol version (3.0)
  writer.writeInt16(3);
  writer.writeInt16(0);

  writer.writeString("user");
  writer.writeString(options.user);

  if (options.database) {
    writer.writeString("database");
    writer.writeString(options.database);
  }

  if (typeof options.replication === "string") {
    writer.writeString("replication");
    writer.writeString(options.replication);
  } else if (typeof options.replication === "boolean") {
    writer.writeString("replication");
    writer.writeString(options.replication ? "true" : "false");
  }

  writer.writeInt8(0);

  // prefix the packet with the packet length
  const lengthWriter = new BinaryWriter(4);
  lengthWriter.writeInt32(4 + writer.byteLength);
  writer.unshift(lengthWriter.buffer);

  return writer.buffer;
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SASLINITIALRESPONSE PostgreSQL Docs}
 */
export class SASLInitialResponse {
  constructor(public mechanism: string, public payload?: string) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.mechanism);
    if (typeof this.payload === "string") {
      writer.writeInt32(this.payload.length);
      writer.encodeInto(this.payload);
    } else {
      writer.writeInt32(-1);
    }

    // length
    writer.unshift(
      new BinaryWriter(4).writeInt32(4 + writer.byteLength).buffer,
    );

    // 'p' code
    writer.unshift(new Uint8Array(["p".charCodeAt(0)]));

    return writer.buffer;
  }
}

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

export class Query {
  static get CODE() {
    // 'Q'
    return 0x51 as const;
  }

  constructor(public sql: string) {}

  get buffer() {
    const writer = new BinaryWriter(5 + this.sql.length);
    writer.writeByte(Query.CODE);
    writer.writeInt32(4 + this.sql.length + 1);
    writer.writeString(this.sql);
    return writer.buffer;
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COMMANDCOMPLETE PostgreSQL Docs}
 */
export class CommandComplete {
  static get CODE() {
    // 'C'
    return 0x43 as const;
  }

  constructor(public commandTag: string) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === CommandComplete.CODE,
      `Expected 'C', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const commandTag = reader.readString();
    return new CommandComplete(commandTag);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DATAROW PostgreSQL Docs}
 */
export class DataRow {
  static get CODE() {
    // 'D'
    return 0x44 as const;
  }

  constructor(public columns: unknown[]) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === DataRow.CODE,
      `Expected 'D', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const columnCount = reader.readInt16();
    const columns = new Array<unknown>(columnCount);
    for (let i = 0; i < columnCount; i++) {
      const columnLength = reader.readInt32();
      if (columnLength === -1) {
        columns[i] = null;
      } else {
        const buffer = new Uint8Array(reader.readBuffer(columnLength));
        columns[i] = decoder.decode(buffer);
      }
    }
    return new DataRow(columns);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ROWDESCRIPTION PostgreSQL Docs}
 */
export class RowDescription {
  static get CODE() {
    // 'T'
    return 0x54 as const;
  }

  constructor(public columns: unknown[]) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === RowDescription.CODE,
      `Expected 'T', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const fieldCount = reader.readInt16();
    const fields = new Array<unknown>(fieldCount);
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

export class ReadyForQuery {
  static get CODE() {
    return 0x5a as const;
  }

  constructor(public transactionStatus: number) {}

  static parse(buffer: ArrayBufferLike) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === ReadyForQuery.CODE,
      `Expected 'Z', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    console.assert(length === 5, `Expected length 5, got ${length}`);
    const transactionStatus = reader.readByte();
    return new ReadyForQuery(transactionStatus);
  }
}

/** Determines which authentication response packet was returned. */
export function authenticationSwitch(buffer: ArrayBufferLike) {
  const reader = new BinaryReader(buffer);
  const code = reader.readByte();
  console.assert(
    code === 0x52, // 'R'
    `Expected 'R', got ${String.fromCharCode(code)}`,
  );

  const length = reader.readInt32();
  const tag = reader.readInt32();
  switch (tag) {
    case 0:
      return AuthenticationOK.parse(buffer);
    case 2:
      // TODO: AuthenticationKerberosV5
      return "AuthenticationKerberosV5";
    case 3:
      // TODO: AuthenticationCleartextPassword
      return "AuthenticationCleartextPassword";
    case 5:
      // TODO: AuthenticationMD5Password
      return "AuthenticationMD5Password";
    // case 0x05:
    //   // TODO: AuthenticationSCMCredential
    case 7:
      // TODO: AuthenticationGSS
      return "AuthenticationGSS";
    case 8:
      // TODO: AuthenticationGSSContinue
      return "AuthenticationGSSContinue";
    case 9:
      // TODO: AuthenticationSSPI
      return "AuthenticationSSPI";
    case 10:
      return AuthenticationSASL.parse(buffer);
    case 11:
      // TODO: AuthenticationSASLContinue
      return "AuthenticationSASLContinue";
    case 12:
      // TODO: AuthenticationSASLFinal
      return "AuthenticationSASLFinal";
    default:
      return ErrorResponse.parse(buffer);
  }
}
