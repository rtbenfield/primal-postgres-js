export interface PostgresBinaryType<T> {
  get name(): string;

  decode(buffer: Uint8Array, types: TypeParser): T;
  encode(value: T, types: TypeParser): Uint8Array;
}

export interface PostgresTextType<T> {
  get name(): string;

  decode(buffer: Uint8Array, types: TypeParser): T;
  encode(value: T, types: TypeParser): Uint8Array;
}

export interface PostgresBinaryTypeParser {
  readonly type: "binary";
  getType<T>(oid: number): PostgresBinaryType<T>;
}

export interface PostgresTextTypeParser {
  readonly type: "text";
  getType<T>(oid: number): PostgresTextType<T>;
}

export type TypeParser = PostgresBinaryTypeParser | PostgresTextTypeParser;

/**
 * An empty Postgres type encoder and decoder for binary data.
 */
export class BinaryTypeParser implements PostgresBinaryTypeParser {
  readonly #types = new Map<number, PostgresBinaryType<unknown>>();

  get type() {
    return "binary" as const;
  }

  getType<T>(oid: number) {
    const type = this.#types.get(oid);
    if (!type) {
      throw new Error(`Unknown OID ${oid}`);
    }
    return type as PostgresBinaryType<T>;
  }

  register(tuples: Iterable<[number, PostgresBinaryType<unknown>]>) {
    for (const [oid, type] of tuples) {
      this.#types.set(oid, type);
    }
    return this;
  }

  setType(oid: number, type: PostgresBinaryType<unknown>) {
    this.#types.set(oid, type);
    return this;
  }
}
