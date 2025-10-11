import { BinaryWriter } from "../binary-writer";

/**
 * Bind (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-BIND PostgreSQL Docs}
 */
export class Bind {
  /** 'B' */
  static readonly CODE = 0x42;

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
