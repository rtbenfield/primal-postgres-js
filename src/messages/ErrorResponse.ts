import { BinaryReader } from "../binary-reader";

/**
 * ErrorResponse (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-ERRORRESPONSE PostgreSQL Docs}
 */
export class ErrorResponse {
  /** 'E' */
  static readonly CODE = 0x45;

  constructor(public fields: PostgresErrorResponse) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);

    const code = reader.readByte();
    // console.assert(
    //   code === ErrorResponse.CODE,
    //   `Expected 'E', got ${String.fromCharCode(code)}`,
    // );

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
        // console.warn(
        //   `Unknown field type '${String.fromCharCode(fieldType)}'`,
        // );
      }
    }

    const nullTerminator = reader.readByte();
    // console.assert(nullTerminator === 0x0, "Expected null terminator");

    return new ErrorResponse(errorResponse);
  }
}

export interface PostgresErrorResponse {
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
