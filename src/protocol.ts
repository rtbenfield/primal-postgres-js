import { BinaryReader } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";

const decoder = new TextDecoder();

/**
 * ErrorResponse (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ERRORRESPONSE PostgreSQL Docs}
 */
export class ErrorResponse {
  static get CODE() {
    // 'E'
    return 0x45 as const;
  }

  constructor(public fields: PostgresErrorResponse) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);

    const code = reader.readByte();
    console.assert(
      code === ErrorResponse.CODE,
      `Expected 'E', got ${String.fromCharCode(code)}`,
    );

    reader.readInt32(); // length, no-op

    const errorResponse: PostgresErrorResponse = {};
    while (reader.remaining > 1) {
      const fieldType = reader.readByte();
      const value = reader.readString();
      switch (fieldType) {
        case 0x56: // 'V' - level
          errorResponse.level = value;
          break;
        case 0x53: // 'S' - Severity
          errorResponse.severity = value;
          break;
        case 0x43: // 'C' - SQLSTATE code
          errorResponse.code = value;
          break;
        case 0x4d: // 'M' - Message
          errorResponse.message = value;
          break;
        case 0x44: // 'D' - Detail
          errorResponse.detail = value;
          break;
        case 0x48: // 'H' - Hint
          errorResponse.hint = value;
          break;
        case 0x50: // 'P' - Position
          errorResponse.position = value;
          break;
        case 0x51: // 'Q' - Internal Query
          errorResponse.internalQuery = value;
          break;
        case 0x57: // 'W' - Where
          errorResponse.where = value;
          break;
        case 0x73: // 's' - Schema
          errorResponse.schema = value;
          break;
        case 0x74: // 't' - Table
          errorResponse.table = value;
          break;
        case 0x63: // 'c' - Column
          errorResponse.column = value;
          break;
        case 0x64: // 'd' - Data Type
          errorResponse.dataType = value;
          break;
        case 0x6e: // 'n' - Constraint
          errorResponse.constraint = value;
          break;
        case 0x46: // 'F' - File
          errorResponse.file = value;
          break;
        case 0x4c: // 'L' - Line
          errorResponse.line = value;
          break;
        case 0x52: // 'R' - Routine
          errorResponse.routine = value;
          break;
        default:
          console.warn(
            `Unknown field type '${String.fromCharCode(fieldType)}'`,
          );
      }
    }

    const nullTerminator = reader.readByte();
    console.assert(nullTerminator === 0x0, "Expected null terminator");

    return new ErrorResponse(errorResponse);
  }
}

interface PostgresErrorResponse {
  severity?: string;
  level?: string;
  code?: string; // SQLSTATE code
  message?: string;
  detail?: string;
  hint?: string;
  position?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONOK PostgreSQL Docs}
 */
export class AuthenticationOK {
  static get CODE() {
    return 0x52; // 'R'
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === AuthenticationOK.CODE,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    console.assert(length === 8, `Expected length 8, got ${length}`);
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

  static parse(buffer: Uint8Array) {
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

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 11, `Expected 11, got ${tag}`);
    console.assert(
      reader.remaining === length - 8,
      `Invalid length of remaining data. Expected ${length - 8}, got ${
        reader.remaining
      }`,
    );
    const data = decoder.decode(reader.rest);
    return new AuthenticationSASLContinue(data);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-AUTHENTICATIONSASLFINAL PostgreSQL Docs}
 */
export class AuthenticationSASLFinal {
  constructor(public payload: string) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === 0x52,
      `Expected 'R', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const tag = reader.readInt32();
    console.assert(tag === 12, `Expected 12, got ${tag}`);
    console.assert(
      reader.remaining === length - 8,
      `Invalid length of remaining data. Expected ${length - 8}, got ${
        reader.remaining
      }`,
    );
    const data = decoder.decode(reader.rest);
    return new AuthenticationSASLFinal(data);
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BACKENDKEYDATA PostgreSQL Docs}
 */
export class BackendKeyData {
  static get CODE() {
    return 0x4b; // 'B'
  }

  constructor(
    public pid: number,
    public secretKey: number,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === BackendKeyData.CODE,
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
  static get CODE() {
    return 0x53; // 'S'
  }

  constructor(
    public parameter: string,
    public value: string,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === ParameterStatus.CODE,
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
  constructor(
    public mechanism: string,
    public payload?: string,
  ) {}

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

  static parse(buffer: Uint8Array) {
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

  constructor(public columns: ReadonlyArray<Uint8Array | null>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === DataRow.CODE,
      `Expected 'D', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const columnCount = reader.readInt16();
    const columns = new Array<Uint8Array | null>(columnCount);
    for (let i = 0; i < columnCount; i++) {
      const columnLength = reader.readInt32();
      if (columnLength === -1) {
        columns[i] = null;
      } else {
        columns[i] = reader.readBuffer(columnLength);
      }
    }
    return new DataRow(columns);
  }
}

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
  static get CODE() {
    // 'T'
    return 0x54 as const;
  }

  constructor(public columns: Array<FieldDescription>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === RowDescription.CODE,
      `Expected 'T', got ${String.fromCharCode(code)}`,
    );
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

export class ReadyForQuery {
  static get CODE() {
    // 'Z'
    return 0x5a as const;
  }

  constructor(public transactionStatus: number) {}

  static parse(buffer: Uint8Array) {
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

/**
 * Parse (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARSECOMPLETE PostgreSQL Docs}
 */
export class Parse {
  static get CODE() {
    // 'P'
    return 0x50 as const;
  }

  constructor(
    /** The name of the destination prepared statement (an empty string selects the unnamed prepared statement). */
    public name: string,
    /** The query string to be parsed.  */
    public query: string,
    public paramTypes: number[],
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.name);
    writer.writeString(this.query);
    writer.writeInt16(this.paramTypes.length);
    for (const paramType of this.paramTypes) {
      writer.writeInt32(paramType);
    }
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Parse.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === Parse.CODE,
      `Expected 'P', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const name = reader.readString();
    const query = reader.readString();
    const numParamTypes = reader.readInt16();
    const paramTypes = new Array<number>(numParamTypes);
    for (let i = 0; i < numParamTypes; i++) {
      paramTypes[i] = reader.readInt32();
    }
    return new Parse(name, query, paramTypes);
  }
}

/**
 * ParseComplete (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-PARSECOMPLETE PostgreSQL Docs}
 */
export class ParseComplete {
  static get CODE() {
    // '1'
    return 0x31 as const;
  }

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(ParseComplete.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === ParseComplete.CODE,
      `Expected '1', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    console.assert(length === 4, `Expected length 4, got ${length}`);
    return new ParseComplete();
  }
}

/**
 * Describe (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-DESCRIBE PostgreSQL Docs}
 */
export class Describe {
  static get CODE() {
    // 'D'
    return 0x44 as const;
  }

  constructor(
    public type: "S" | "P",
    public name: string,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(this.type);
    writer.writeString(this.name);
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Describe.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }
}

/**
 * Bind (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BIND PostgreSQL Docs}
 */
export class Bind {
  static get CODE() {
    // 'B'
    return 0x42 as const;
  }

  constructor(
    /** The name of the destination portal (an empty string selects the unnamed portal). */
    public destinationName: string,
    /** The name of the source prepared statement (an empty string selects the unnamed prepared statement). */
    public sourceName: string,
    /** The parameter values. */
    public parameterValues: ReadonlyArray<null | string | Uint8Array>,
    /**
     * The result-column format codes. Each must presently be zero (text) or one (binary).
     *
     * This can be zero to indicate that there are no result columns or that the result columns should all use the
     * default format (text); or one, in which case the specified format code is applied to all result columns (if any);
     * or it can equal the actual number of result columns of the query.
     */
    public resultFormatCodes: ReadonlyArray<0 | 1>,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.destinationName);
    writer.writeString(this.sourceName);

    // parameter format codes
    // TODO: there are some optimizations that can be done here if all parameters are the same type
    writer.writeInt16(this.parameterValues.length);
    for (const value of this.parameterValues) {
      if (value === null) {
        // NULL could be either 0 or 1
        writer.writeInt16(0);
      } else if (typeof value === "string") {
        writer.writeInt16(0);
      } else if (value instanceof Uint8Array) {
        writer.writeInt16(1);
      } else {
        throw new TypeError(
          "Expected string or Uint8Array for parameter value",
        );
      }
    }

    // parameter values
    writer.writeInt16(this.parameterValues.length);
    for (const value of this.parameterValues) {
      if (value === null) {
        writer.writeInt32(-1);
      } else if (typeof value === "string") {
        writer.writeInt32(value.length);
        writer.encodeInto(value);
      } else if (value instanceof Uint8Array) {
        writer.writeInt32(value.byteLength);
        writer.writeBuffer(value);
      } else {
        throw new TypeError(
          "Expected string Uint8Array, or null for parameter value",
        );
      }
    }

    // result format codes, if applicable
    writer.writeInt16(this.resultFormatCodes.length);
    for (const formatCode of this.resultFormatCodes) {
      writer.writeInt16(formatCode);
    }

    writer.unshift(
      new BinaryWriter(5).writeByte(Bind.CODE).writeInt32(4 + writer.byteLength)
        .buffer,
    );
    return writer.buffer;
  }
}

/**
 * BindComplete (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BINDCOMPLETE PostgreSQL Docs}
 */
export class BindComplete {
  static get CODE() {
    // '2'
    return 0x32 as const;
  }

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(ParseComplete.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === BindComplete.CODE,
      `Expected '2', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    console.assert(length === 4, `Expected length 4, got ${length}`);
    return new BindComplete();
  }
}

/**
 * Execute (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-EXECUTE PostgreSQL Docs}
 */
export class Execute {
  static get CODE() {
    // 'E'
    return 0x45 as const;
  }

  constructor(
    /** The name of the portal to execute (an empty string selects the unnamed portal). */
    public name: string = "",
    /** Maximum number of rows to return, if portal contains a query that returns rows (ignored otherwise). Zero denotes “no limit”. */
    public limit: number = 0,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeString(this.name);
    writer.writeInt32(this.limit);
    writer.unshift(
      new BinaryWriter(5)
        .writeByte(Execute.CODE)
        .writeInt32(4 + writer.byteLength).buffer,
    );
    return writer.buffer;
  }
}

/**
 * Sync (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-SYNC PostgreSQL Docs}
 */
export class Sync {
  static get CODE() {
    // 'S'
    return 0x53 as const;
  }

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Sync.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}

export class ParameterDescription {
  static get CODE() {
    // 't'
    return 0x74 as const;
  }

  constructor(public parameterTypes: ReadonlyArray<number>) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === ParameterDescription.CODE,
      `Expected 't', got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32();
    const numParams = reader.readInt16();
    const paramTypes = new Array<number>(numParams);
    for (let i = 0; i < numParams; i++) {
      paramTypes[i] = reader.readInt32();
    }
    return new ParameterDescription(paramTypes);
  }
}

/**
 * Flush (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-FLUSH PostgreSQL Docs}
 */
export class Flush {
  static get CODE() {
    // 'H'
    return 0x48 as const;
  }

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Flush.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}

/**
 * Terminate (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-TERMINATE PostgreSQL Docs}
 */
export class Terminate {
  static get CODE() {
    // 'X'
    return 0x58 as const;
  }

  get buffer() {
    const writer = new BinaryWriter(5);
    writer.writeByte(Terminate.CODE);
    writer.writeInt32(4);
    return writer.buffer;
  }
}

/** Determines which authentication response packet was returned. */
export function authenticationSwitch(buffer: Uint8Array) {
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

/**
 * NoData (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-NODATA PostgreSQL Docs}
 */
export class NoData {
  static get CODE() {
    // 'n'
    return 0x6e as const;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const length = reader.readInt32(); // length
    console.assert(length === 4, `Expected length 4, got ${length}`);
  }
}

/**
 * CopyBothResponse (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COPYBOTHRESPONSE PostgreSQL Docs}
 */
export class CopyBothResponse {
  static get CODE() {
    return 0x57 as const; // 'W'
  }

  constructor(
    public formatCode: number,
    public columnFormats: number[],
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === CopyBothResponse.CODE,
      `Expected ${String.fromCharCode(CopyBothResponse.CODE)}, got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32(); // length
    console.assert(length === 7, `Expected length 4, got ${length}`);
    const formatCode = reader.readByte();
    const numCols = reader.readInt16();
    const columnFormats = new Array<number>(numCols);
    for (let i = 0; i < numCols; i++) {
      columnFormats[i] = reader.readInt16();
    }
    return new CopyBothResponse(formatCode, columnFormats);
  }
}

/**
 * CopyData (F & B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-COPYDATA PostgreSQL Docs}
 */
export class CopyData {
  static get CODE() {
    // 'd'
    return 0x64 as const;
  }

  constructor(public data: Uint8Array) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(CopyData.CODE);
    writer.writeInt32(4 + this.data.byteLength);
    writer.writeBuffer(this.data);
    return writer.buffer;
  }

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === CopyData.CODE,
      `Expected ${String.fromCharCode(CopyData.CODE)}, got ${String.fromCharCode(code)}`,
    );
    const length = reader.readInt32(); // length
    const data = reader.readBuffer(length - 4);
    console.assert(
      reader.remaining === 0,
      `Invalid remaining data. Expected 0, got ${reader.remaining}`,
    );
    return new CopyData(data);
  }
}
