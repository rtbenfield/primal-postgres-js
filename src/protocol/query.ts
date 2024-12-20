import {
  Bind,
  BindComplete,
  CommandComplete,
  DataRow,
  Describe,
  Execute,
  Parse,
  ParseComplete,
  Query,
  ReadyForQuery,
  RowDescription,
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

  let reply = yield new Parse("", sql, []).buffer;
  ParseComplete.parse(
    reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength),
  );

  reply = yield new Describe("S", "foo").buffer;
  // TODO: ParameterDescription
  RowDescription.parse(
    reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength),
  );

  reply = yield new Bind("", "foo", parameters, []).buffer;
  BindComplete.parse(
    reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength),
  );

  reply = yield new Execute().buffer;

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
