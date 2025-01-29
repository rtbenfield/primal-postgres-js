const decoder = new TextDecoder("utf-8");

/**
 * A utility for reading binary data from a Uint8Array buffer.
 */
export class BinaryReader {
  #position = 0;
  readonly #buffer: Uint8Array;
  readonly #view: DataView;

  constructor(buffer: Uint8Array) {
    this.#buffer = buffer;

    //! retain the original offset and length of the Uint8Array
    // this is important because the ArrayBuffer may contain multiple messages
    this.#view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
  }

  /** Returns the number of bytes remaining to be read. */
  get remaining() {
    return this.#view.byteLength - this.#position;
  }

  /** Returns the remaining bytes in the buffer. */
  get rest() {
    return this.#buffer.subarray(this.#position);
  }

  /** Peeks at the next byte in the buffer without advancing the position. */
  peekByte() {
    return this.#view.getUint8(this.#position);
  }

  /**
   * Reads a portion of the buffer up to the specified length and advances the
   * position.
   */
  readBuffer(length: number) {
    const buffer = this.#buffer.subarray(
      this.#position,
      this.#position + length,
    );
    this.#position += length;
    return buffer;
  }

  /**
   * Reads a single byte from the buffer and advances the position.
   */
  readByte() {
    const value = this.peekByte();
    this.#position++;
    return value;
  }

  /**
   * Reads a double-precision floating point number from the buffer and advances
   * the position.
   */
  readFloat64() {
    const value = this.#view.getFloat64(this.#position, false);
    this.#position += 8;
    return value;
  }

  /**
   * Reads a 16-bit integer from the buffer and advances the position.
   */
  readInt16() {
    const value = this.#view.getUint16(this.#position, false);
    this.#position += 2;
    return value;
  }

  /**
   * Reads a 32-bit integer from the buffer and advances the position.
   */
  readInt32() {
    const value = this.#view.getUint32(this.#position, false);
    this.#position += 4;
    return value;
  }

  /**
   * Reads a 64-bit integer from the buffer and advances the position. This
   * matches to the INT8 data type in the Postgres protocol.
   */
  readInt64() {
    const value = this.#view.getBigUint64(this.#position, false);
    this.#position += 8;
    return value;
  }

  /**
   * Reads an OID from the buffer returning the numeric value and advances the
   * position
   */
  readOid() {
    return this.readInt32();
  }

  /**
   * Reads a fixed-length string from the buffer of the specified length and
   * advances the position.
   */
  readFixedLengthString(length: number) {
    const start = this.#position;
    this.#position += length;
    return decoder.decode(this.#buffer.subarray(start, start + length));
  }

  /**
   * Reads a null-terminated string from the buffer and advances the position.
   */
  readString() {
    const start = this.#position;

    // scan until we find the null terminator (0x00) to determine string length
    let length = 0;
    while (this.#view.getUint8(this.#position) !== 0x0) {
      this.#position++;
      length++;
    }

    // move past the null terminator
    this.#position++;

    // decode the string from the bytes
    return decoder.decode(this.#buffer.subarray(start, start + length));
  }
}
