import { ConsoleLogger, Logger } from "./logger";
import {
  DataRow,
  ParameterDescription,
  Query,
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
import { PostgresAlignmentStream } from "./streams";
import { TypeParser } from "./types/mod";

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
  logger?: Logger;
  socket: SocketFactory;
  types: TypeParser;
}

export class Client {
  readonly #connection;
  readonly #logger;
  readonly #options;

  constructor(options: ClientOptions) {
    this.#options = options;
    this.#connection = resolveConnection(options.connection);
    this.#logger = options.logger ?? new ConsoleLogger("warn");
  }

  async connect(): Promise<Connection> {
    const socket = await this.#options.socket(
      this.#connection.hostname,
      this.#connection.port,
    );

    const patchedSocket: Socket = {
      readable: socket.readable.pipeThrough(new PostgresAlignmentStream()),
      writable: socket.writable,
    };

    const { parameters } = await executeSequence(
      patchedSocket,
      startupSequence(this.#connection),
      this.#logger,
    );
    this.#logger.debug("connetion parameters", { parameters });

    return new Connection(patchedSocket, this.#options.types, this.#logger);
  }
}

export class Connection {
  readonly #logger;
  readonly #socket: Socket;
  readonly #types: TypeParser;

  constructor(socket: Socket, types: TypeParser, logger: Logger) {
    this.#logger = logger;
    this.#socket = socket;
    this.#types = types;
  }

  async [Symbol.asyncDispose]() {
    // TODO: the writer might be locked in another sequence
    //? how should the connection handle the case that it is closed mid-sequence?
    await this.close().catch((e) =>
      this.#logger.error("error closing connection", e),
    );
  }

  async close() {
    const writer = this.#socket.writable.getWriter();
    try {
      const buffer = new Terminate().buffer;
      this.#logger.debug("--> [X]", { buffer });
      await writer.write(buffer);
    } finally {
      writer.releaseLock();
    }
  }

  async query(sql: string) {
    return await executeSequenceStream(
      this.#socket,
      simpleQuerySequence(sql),
      this.#logger,
    );
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
      this.#logger,
    );
  }

  async prepare(sql: string) {
    const { parameterDescriptions, rowDescriptions } = await executeSequence(
      this.#socket,
      prepareSequence(sql, ""),
      this.#logger,
    );
    const parameterDescription =
      parameterDescriptions.at(0) ?? new ParameterDescription([]);
    return new PreparedStatement(
      this.#socket,
      this.#types,
      this.#logger,
      parameterDescription,
      rowDescriptions,
    );
  }

  async send(sql: string) {
    const writer = this.#socket.writable.getWriter();
    try {
      const buffer = new Query(sql).buffer;
      this.#logger.debug("--> [Q]", { buffer });
      await writer.write(buffer);
    } finally {
      writer.releaseLock();
    }

    return this.#socket;
  }
}

export class PreparedStatement<
  Params extends ReadonlyArray<any> = ReadonlyArray<unknown>,
  Result = unknown,
  Types extends TypeParser = TypeParser,
> {
  readonly #logger: Logger;
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
    logger: Logger,
    parameterDescription: ParameterDescription,
    rowDescription: ReadonlyArray<RowDescription>,
  ) {
    this.#logger = logger;
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
      return row.columns.map((col) => {
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
      this.#logger,
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
          } else if (this.#types.type === "text") {
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

  /**
   * Reads the first row from the result set and discards the rest.
   */
  async first() {
    const reader = this.#rows.getReader();
    const { value, done } = await reader.read();
    try {
      if (done) {
        return undefined;
      } else {
        await reader.cancel();
        return value;
      }
    } finally {
      reader.releaseLock();
    }
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
