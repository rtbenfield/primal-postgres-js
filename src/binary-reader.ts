const decoder = new TextDecoder("utf-8");

export class BinaryReader {
  #position = 0;
  readonly #view: DataView;
  readonly #buffer: Uint8Array;

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

  get remaining() {
    return this.#view.byteLength - this.#position;
  }

  get rest() {
    return this.#buffer.subarray(this.#position);
  }

  peekByte() {
    return this.#view.getUint8(this.#position);
  }

  readBuffer(length: number) {
    const buffer = this.#buffer.subarray(
      this.#position,
      this.#position + length,
    );
    this.#position += length;
    return buffer;
  }

  readByte() {
    const value = this.peekByte();
    this.#position++;
    return value;
  }

  readFloat64() {
    const value = this.#view.getFloat64(this.#position, false);
    this.#position += 8;
    return value;
  }

  readInt16() {
    const value = this.#view.getUint16(this.#position, false);
    this.#position += 2;
    return value;
  }

  readInt32() {
    const value = this.#view.getUint32(this.#position, false);
    this.#position += 4;
    return value;
  }

  /**
   * Reads a 64-bit integer from the buffer. This also matches to the INT8
   * data type in the Postgres protocol.
   */
  readInt64() {
    const value = this.#view.getBigUint64(this.#position, false);
    this.#position += 8;
    return value;
  }

  /** Reads an OID from the buffer and returns the numeric value. */
  readOid() {
    return this.readInt32();
  }

  readFixedLengthString(length: number) {
    const start = this.#position;
    this.#position += length;
    return decoder.decode(this.#buffer.subarray(start, start + length));
  }

  /**
   * Reads a null-terminated string from the buffer.
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
