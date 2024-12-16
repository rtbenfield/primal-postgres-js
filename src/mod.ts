import { BinaryReader } from "./binary-reader";
import { executeSequence, querySequence, startupSequence } from "./sequence";

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

    await executeSequence(patchedSocket, startupSequence(this.#connection));

    return new Connection(patchedSocket);
  }
}

export class Connection {
  readonly #socket: Socket;

  constructor(socket: Socket) {
    this.#socket = socket;
  }

  async query(sql: string) {
    return await executeSequence(this.#socket, querySequence(sql));
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
          const reader = new BinaryReader(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
          );
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
