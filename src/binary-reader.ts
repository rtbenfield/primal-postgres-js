const decoder = new TextDecoder("utf-8");

export class BinaryReader {
  #position = 0;
  readonly #view: DataView;

  constructor(
    buffer: ArrayBufferLike,
    byteOffset?: number,
    byteLength?: number,
  ) {
    this.#view = new DataView(buffer, byteOffset, byteLength);
  }

  get remaining() {
    return this.#view.byteLength - this.#position;
  }

  get rest() {
    return new Uint8Array(
      this.#view.buffer,
      this.#view.byteOffset + this.#position,
    );
  }

  peekByte() {
    return this.#view.getUint8(this.#position);
  }

  readBuffer(length: number) {
    const buffer = this.#view.buffer.slice(
      this.#view.byteOffset + this.#position,
      this.#view.byteOffset + this.#position + length,
    );
    this.#position += length;
    return buffer;
  }

  readByte() {
    const value = this.peekByte();
    this.#position++;
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
    const buffer = this.#view.buffer.slice(start, start + length);
    return decoder.decode(new Uint8Array(buffer));
  }
}
