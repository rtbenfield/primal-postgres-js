import { BinaryReader } from "./binary-reader";
import {
  DataRow,
  ParameterDescription,
  RowDescription,
  Terminate,
} from "./protocol";
import {
  executePreparedStatementSequence,
  extendedQuerySequence,
  prepareSequence,
  simpleQuerySequence,
} from "./protocol/query";
import { startupSequence } from "./protocol/startup";
import { executeSequence, executeSequenceStream } from "./sequence";

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

export type TypeParser =
  | {
      readonly type: "binary";
      getType<T>(oid: number): PostgresBinaryType<T>;
    }
  | {
      readonly type: "string";
      getType<T>(oid: number): PostgresTextType<T>;
    };

export interface ConnectionOptions {
  database: string;
  hostname: string;
  /** @default 5432 */
  port?: number;
  /** @default false */
  replication?: true | false | "database";
  username: string;
  password?: string;
}

export interface Socket {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

export type SocketFactory = (hostname: string, port: number) => Promise<Socket>;

export interface ClientOptions {
  connection: string | URL | ConnectionOptions;
  socket: SocketFactory;
  types: TypeParser;
}

export class Client {
  readonly #connection;
  readonly #options;

  constructor(options: ClientOptions) {
    this.#options = options;
    this.#connection = resolveConnection(options.connection);
  }

  async connect(): Promise<Connection> {
    const socket = await this.#options.socket(
      this.#connection.hostname,
      this.#connection.port,
    );

    const patchedSocket: Socket = {
      readable: socket.readable.pipeThrough(new PostgresMessageSplitStream()),
      writable: socket.writable,
    };

    const { parameters } = await executeSequence(
      patchedSocket,
      startupSequence(this.#connection),
    );
    console.debug("connetion parameters", parameters);

    return new Connection(patchedSocket, this.#options.types);
  }
}

export class Connection {
  readonly #socket: Socket;
  readonly #types: TypeParser;

  constructor(socket: Socket, types: TypeParser) {
    this.#socket = socket;
    this.#types = types;
  }

  async [Symbol.asyncDispose]() {
    // TODO: the writer might be locked in another sequence
    //? how should the connection handle the case that it is closed mid-sequence?
    await this.close().catch((e) =>
      console.error("error closing connection", e),
    );
  }

  async close() {
    const writer = this.#socket.writable.getWriter();
    try {
      const buffer = new Terminate().buffer;
      console.debug("--> [X]", buffer);
      await writer.write(buffer);
    } finally {
      writer.releaseLock();
    }
  }

  async query(sql: string) {
    return await executeSequenceStream(this.#socket, simpleQuerySequence(sql));
  }

  /** @deprecated */
  async extendedQuery(
    sql: string,
    parameters: ReadonlyArray<null | string | Uint8Array>,
  ) {
    return await executeSequenceStream(
      this.#socket,
      extendedQuerySequence(
        sql,
        parameters,
        this.#types.type === "binary" ? 1 : 0,
      ),
    );
  }

  async prepare(sql: string) {
    const { parameterDescriptions, rowDescriptions } = await executeSequence(
      this.#socket,
      prepareSequence(sql, ""),
    );
    const parameterDescription = parameterDescriptions.at(0);
    if (!parameterDescription) {
      throw new Error("no parameter description");
    }
    return new PreparedStatement(
      this.#socket,
      this.#types,
      parameterDescription,
      rowDescriptions,
    );
  }
}

export class PreparedStatement<
  Params extends ReadonlyArray<any> = ReadonlyArray<unknown>,
  Result = unknown,
  Types extends TypeParser = TypeParser,
> {
  readonly #socket: Socket;
  readonly #types: TypeParser;

  readonly #parameterEncoding;
  readonly #resultDecoding;

  /**
   * Constructs a new PreparedStatement instance.
   * @param socket The socket to the PostgreSQL server. The socket must already
   * be connected and the statement must have been prepared on this connection.
   * @param types The type parser to use for parameters and results.
   * @param parameterDescription The parameter description results from running
   * a Describe on the prepared statement.
   * @param rowDescription The row description results from running a Describe
   * on the prepared statement.
   */
  constructor(
    socket: Socket,
    types: Types,
    parameterDescription: ParameterDescription,
    rowDescription: ReadonlyArray<RowDescription>,
  ) {
    this.#socket = socket;
    this.#types = types;

    this.#parameterEncoding = parameterDescription.parameterTypes.map((oid) => {
      const encoder = this.#types.getType(oid);
      if (!encoder) {
        throw new Error(`no type encoder for OID ${oid}`);
      }
      return encoder.encode;
    });

    this.#resultDecoding = rowDescription.map((row) => {
      return row.columns.map((col, i) => {
        const type = this.#types.getType(col.oid);
        if (!type) {
          throw new Error(`no type decoder for OID ${col.oid}`);
        }
        return [col.fieldName, type.decode] as const;
      });
    });
  }

  async execute(parameters: Params) {
    if (parameters.length !== this.#parameterEncoding.length) {
      throw new Error(
        `Expected ${this.#parameterEncoding.length} parameters, got ${parameters.length}`,
      );
    }

    const encodedParameters = this.#parameterEncoding.map((encoder, i) =>
      encoder(parameters[i], this.#types),
    );

    const formatCode = this.#types.type === "binary" ? 1 : 0;
    const stream = await executeSequenceStream(
      this.#socket,
      executePreparedStatementSequence(encodedParameters, formatCode),
    );
    const transform = new TransformStream<DataRow, Result>({
      transform: (row, controller) => {
        // TODO: handle multiple result sets
        const rowDescription = this.#resultDecoding.at(0)!;
        const entries = rowDescription.map(([name, decoder], i) => {
          const raw = row.columns[i];
          if (typeof raw === "undefined") {
            throw new Error(
              `Expected ${rowDescription.length} columns, got ${row.columns.length}`,
            );
          } else if (raw === null) {
            return [name, null] as const;
          } else if (this.#types.type === "string") {
            const value = new TextDecoder().decode(raw);
            return [name, decoder(value as any, this.#types)] as const;
          } else {
            return [name, decoder(raw as any, this.#types)] as const;
          }
        });
        const result = Object.fromEntries(entries) as Result;
        controller.enqueue(result);
      },
    });
    const finalResults = stream.pipeThrough(transform);
    return new QueryResult(finalResults);
  }
}

export class QueryResult<T> implements AsyncIterable<T> {
  readonly #rows: ReadableStream<T>;

  constructor(rows: ReadableStream<T>) {
    this.#rows = rows;
  }

  async [Symbol.asyncDispose]() {
    await this.cancel();
  }

  [Symbol.asyncIterator]() {
    return this.#rows[Symbol.asyncIterator]();
  }

  async cancel() {
    await this.#rows.cancel();
  }

  async toArray() {
    const rows = new Array<T>();
    for await (const row of this.#rows) {
      rows.push(row);
    }
    return rows;
  }
}

function resolveConnection(
  connection: string | URL | ConnectionOptions,
): ResolvedConnectionOptions {
  if (connection instanceof URL) {
    return {
      database: connection.pathname.replace("/", ""),
      hostname: connection.hostname,
      port: Number(connection.port ?? 5432),
      replication: false,
      username: connection.username,
      password: connection.password || null,
    };
  } else if (typeof connection === "string") {
    const uri = new URL(connection);
    return {
      database: uri.pathname.replace("/", ""),
      hostname: uri.hostname,
      port: Number(uri.port ?? 5432),
      replication: false,
      username: uri.username,
      password: uri.password || null,
    };
  } else {
    return {
      database: connection.database,
      hostname: connection.hostname,
      port: 5432,
      replication: connection.replication ?? false,
      username: connection.username,
      password: connection.password ?? null,
    };
  }
}

export interface ResolvedConnectionOptions {
  database: string;
  hostname: string;
  port: number;
  replication: true | false | "database";
  username: string;
  password: string | null;
}

/**
 * Postgres will sometimes batch multiple messages into a single packet.
 * To simplify downstream processing, this transformer splits them before
 * enqueuing them for the next consumer.
 */
class PostgresMessageSplitStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor() {
    super({
      transform(chunk, controller) {
        let buffer = chunk;

        while (buffer.byteLength > 0) {
          const reader = new BinaryReader(buffer);
          reader.readByte();
          const packetLength = reader.readInt32() + 1;
          const packet = buffer.subarray(0, packetLength);
          controller.enqueue(packet);
          buffer = buffer.subarray(packetLength);
        }
      },
    });
  }
}
