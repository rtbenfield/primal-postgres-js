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

  writeBuffer(value: ArrayBufferLike) {
    const position = this.#buffer.byteLength;
    this.#buffer.resize(this.#buffer.byteLength + value.byteLength);
    const buffer = new Uint8Array(this.buffer);
    buffer.set(new Uint8Array(value), position);
    return this;
  }

  writeByte(value: number) {
    return this.writeInt8(value);
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

  writeString(value: string) {
    // encode the value
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);

    // resize the buffer
    let position = this.#buffer.byteLength;
    this.#buffer.resize(this.#buffer.byteLength + encoded.byteLength);

    // write the value
    const buffer = new Uint8Array(this.#buffer);
    buffer.set(encoded, position);

    // write the null terminator
    return this.writeInt8(0);
  }
}
