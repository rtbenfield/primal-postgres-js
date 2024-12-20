import { BinaryReader } from "./binary-reader";
import {
  Bind,
  BindComplete,
  CommandComplete,
  DataRow,
  Describe,
  ErrorResponse,
  Execute,
  Flush,
  ParameterDescription,
  Parse,
  ParseComplete,
  ReadyForQuery,
  RowDescription,
  Sync,
} from "./protocol";
import { simpleQuerySequence } from "./protocol/query";
import { startupSequence } from "./protocol/startup";
import { executeSequence, executeSequenceStream } from "./sequence";

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
      this.#connection.port
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
    return await executeSequenceStream(this.#socket, simpleQuerySequence(sql));
  }

  async query2(
    sql: string,
    parameters: ReadonlyArray<null | string | Uint8Array>
  ) {
    const reader = this.#socket.readable.getReader();
    const writer = this.#socket.writable.getWriter();
    try {
      await writer.write(new Parse("", sql, []).buffer);
      await writer.write(new Describe("S", "").buffer);
      await writer.write(new Bind("", "", parameters, []).buffer);
      await writer.write(new Execute("").buffer);
      await writer.write(new Sync().buffer);
      // ? is a Flush necessary?
      // Postgres buffers the responses to minimize back-and-forth
      // the Sync seems to cause a flush, but I'm not sure if that's consistent
      await writer.write(new Flush().buffer);

      const parameterDescriptions = new Array<ParameterDescription>();
      const rowDescriptions = new Array<RowDescription>();
      const dataRows = new Array<DataRow>();
      while (true) {
        const reply = await reader.read();
        if (reply.done) {
          throw new Error(`connection was closed unexpectedly`);
        }
        console.info(
          "<--",
          String.fromCharCode(reply.value.at(0)!)
          // reply.value,
        );
        const replyBuffer = reply.value.buffer.slice(
          reply.value.byteOffset,
          reply.value.byteOffset + reply.value.byteLength
        );
        switch (reply.value.at(0)) {
          case BindComplete.CODE: {
            BindComplete.parse(replyBuffer);
            continue;
          }
          case ParseComplete.CODE: {
            continue;
          }
          case ParameterDescription.CODE: {
            const parameterDescription =
              ParameterDescription.parse(replyBuffer);
            parameterDescriptions.push(parameterDescription);
            continue;
          }
          case RowDescription.CODE: {
            const rowDescription = RowDescription.parse(replyBuffer);
            rowDescriptions.push(rowDescription);
            continue;
          }
          case ErrorResponse.CODE: {
            const errorResponse = ErrorResponse.parse(replyBuffer);
            throw errorResponse;
          }
          case DataRow.CODE: {
            const dataRow = DataRow.parse(replyBuffer);
            dataRows.push(dataRow);
            continue;
          }
          case CommandComplete.CODE: {
            CommandComplete.parse(replyBuffer);
            continue;
          }
          case ReadyForQuery.CODE: {
            ReadyForQuery.parse(replyBuffer);
            return new ReadableStream({
              start(controller) {
                for (const dataRow of dataRows) {
                  controller.enqueue(dataRow);
                }
                controller.close();
              },
            });
          }
          default: {
            throw new Error(
              `Unexpected packet type ${String.fromCharCode(
                reply.value.at(0)!
              )}`
            );
          }
        }
      }
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }
  }
}

function resolveConnection(
  connection: string | URL | ConnectionOptions
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
            buffer.byteLength
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
