const encoder = new TextEncoder();

export class BinaryWriter {
  #buffer: ArrayBuffer;

  constructor(initialSize?: number) {
    this.#buffer = new ArrayBuffer(0, { maxByteLength: 1024 });
  }

  get buffer() {
    return new Uint8Array(this.#buffer);
  }

  get byteLength() {
    return this.#buffer.byteLength;
  }

  /**
   * Encodes the specified string into the buffer without a null-terminator.
   */
  encodeInto(value: string) {
    const position = this.#buffer.byteLength;
    this.#buffer.resize(this.#buffer.byteLength + value.length);
    encoder.encodeInto(
      value,
      new Uint8Array(this.#buffer, position, value.length),
    );
    return this;
  }

  unshift(value: Uint8Array) {
    // grab a handle to the original buffer before resize
    // the end position is important for this
    const original = new Uint8Array(this.#buffer).subarray(
      0,
      this.#buffer.byteLength,
    );

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + value.byteLength);

    // shift the existing bytes to the right
    const buffer = new Uint8Array(this.#buffer);
    buffer.set(original, value.byteLength);

    // copy the new value into the new buffer at the start
    buffer.set(value, 0);

    return this;
  }

  writeBuffer(value: ArrayBufferLike): this;
  writeBuffer(value: Uint8Array): this;
  writeBuffer(value: ArrayBufferLike | Uint8Array) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const position = this.#buffer.byteLength;
    this.#buffer.resize(this.#buffer.byteLength + bytes.byteLength);
    const buffer = new Uint8Array(this.#buffer);
    buffer.set(bytes, position);
    return this;
  }

  writeByte(value: number): this;
  writeByte(value: string): this;
  writeByte(value: number | string) {
    if (typeof value === "string") {
      if (value.length !== 1) {
        throw new RangeError(
          `Expected string of length 1, got ${value.length}`,
        );
      }
      return this.encodeInto(value);
    } else if (typeof value === "number") {
      return this.writeInt8(value);
    } else {
      throw new TypeError(`Expected number or string, got ${typeof value}`);
    }
  }

  writeFloat64(value: number) {
    const position = this.#buffer.byteLength;

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + 8);

    // write the value
    const view = new DataView(this.#buffer);
    view.setFloat64(position, value, false);

    return this;
  }

  writeInt8(value: number) {
    const position = this.#buffer.byteLength;

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + 1);

    // write the value
    const view = new DataView(this.#buffer);
    view.setUint8(position, value);

    return this;
  }

  writeInt16(value: number) {
    const position = this.#buffer.byteLength;

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + 2);

    // write the value
    const view = new DataView(this.#buffer);
    view.setUint16(position, value, false);

    return this;
  }

  writeInt32(value: number) {
    const position = this.#buffer.byteLength;

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + 4);

    // write the value
    const view = new DataView(this.#buffer);
    view.setUint32(position, value, false);

    return this;
  }

  writeInt64(value: bigint) {
    const position = this.#buffer.byteLength;

    // resize the buffer
    this.#buffer.resize(this.#buffer.byteLength + 8);

    // write the value
    const view = new DataView(this.#buffer);
    view.setBigUint64(position, value, false);

    return this;
  }

  writeOid(value: number) {
    return this.writeInt32(value);
  }

  /**
   * Writes the specified string into the buffer along with a null-terminator.
   */
  writeString(value: string) {
    // encode the string into the buffer
    // then terminate with a null byte
    return this.encodeInto(value).writeInt8(0);
  }
}
