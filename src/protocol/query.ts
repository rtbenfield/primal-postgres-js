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
  Query,
  ReadyForQuery,
  RowDescription,
  Sync,
} from "../protocol";
import { Sequence } from "../sequence";

/**
 * @see @link{https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SIMPLE-QUERY PostgreSQL Docs}
 */
export async function* simpleQuerySequence(
  sql: string,
): Sequence<TransformStream<Uint8Array, DataRow>> {
  // TODO: this is a minimal implementation that does not handle much yet
  let reply = yield new Query(sql).buffer;
  const rowDescription = RowDescription.parse(
    reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength),
  );

  return new TransformStream<Uint8Array, DataRow>({
    transform(chunk, controller) {
      switch (chunk.at(0)) {
        case DataRow.CODE: {
          const dataRow = DataRow.parse(
            chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.byteLength,
            ),
          );
          controller.enqueue(dataRow);
          break;
        }
        case CommandComplete.CODE: {
          CommandComplete.parse(
            chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.byteLength,
            ),
          );
          console.info("commandComplete");
          break;
        }
        case ReadyForQuery.CODE: {
          ReadyForQuery.parse(
            chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.byteLength,
            ),
          );
          controller.terminate();
          break;
        }
      }
    },
  });
}

/**
 * @see @link{https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY PostgreSQL Docs}
 */
export async function* extendedQuerySequence(
  sql: string,
  parameters: ReadonlyArray<null | string | Uint8Array>,
): Sequence<TransformStream<Uint8Array, DataRow>> {
  // TODO: this is a minimal implementation that does not handle much yet

  // we can write all of the messages in one shot for efficiency
  yield [
    new Parse("", sql, []).buffer,
    new Describe("S", "").buffer,
    new Bind("", "", parameters, []).buffer,
    new Execute("").buffer,
    new Sync().buffer,
    // ? is a Flush necessary?
    // Postgres buffers the responses to minimize back-and-forth
    // the Sync seems to cause a flush, but I'm not sure if that's consistent
    new Flush().buffer,
  ];

  const parameterDescriptions = new Array<ParameterDescription>();
  const rowDescriptions = new Array<RowDescription>();
  return new TransformStream<Uint8Array, DataRow>({
    transform(message, controller) {
      const replyBuffer = message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength,
      );
      switch (message.at(0)) {
        case BindComplete.CODE: {
          BindComplete.parse(replyBuffer);
          return;
        }
        case ParseComplete.CODE: {
          return;
        }
        case ParameterDescription.CODE: {
          const parameterDescription = ParameterDescription.parse(replyBuffer);
          parameterDescriptions.push(parameterDescription);
          return;
        }
        case RowDescription.CODE: {
          const rowDescription = RowDescription.parse(replyBuffer);
          rowDescriptions.push(rowDescription);
          return;
        }
        case ErrorResponse.CODE: {
          const errorResponse = ErrorResponse.parse(replyBuffer);
          throw errorResponse;
        }
        case DataRow.CODE: {
          const dataRow = DataRow.parse(replyBuffer);
          controller.enqueue(dataRow);
          return;
        }
        case CommandComplete.CODE: {
          CommandComplete.parse(replyBuffer);
          return;
        }
        case ReadyForQuery.CODE: {
          ReadyForQuery.parse(replyBuffer);
          controller.terminate();
          return;
        }
        default: {
          throw new Error(
            `Unexpected packet type ${String.fromCharCode(message.at(0)!)}`,
          );
        }
      }
    },
  });
}

export class QueryResult<T> implements AsyncIterable<T> {
  constructor(public rows: AsyncIterable<T>) {}

  [Symbol.asyncIterator]() {
    return this.rows[Symbol.asyncIterator]();
  }

  async toArray() {
    const rows = new Array<T>();
    for await (const row of this.rows) {
      rows.push(row);
    }
    return rows;
  }
}
