import {
  Bind,
  BindComplete,
  CommandComplete,
  DataRow,
  Describe,
  ErrorResponse,
  Execute,
  NoData,
  ParameterDescription,
  Parse,
  ParseComplete,
  Query,
  ReadyForQuery,
  RowDescription,
  Sync,
} from "../protocol";
import { NOREPLY, Sequence, SKIP } from "../sequence";

/**
 * @see @link{https://www.postgresql.org/docs/current/protocol-flow.html#PROTOCOL-FLOW-SIMPLE-QUERY PostgreSQL Docs}
 */
export async function* simpleQuerySequence(
  sql: string,
): Sequence<TransformStream<Uint8Array, DataRow>> {
  // TODO: this is a minimal implementation that does not handle much yet
  let reply = yield new Query(sql).buffer;
  let rowDescriptions = new Array<RowDescription>();
  switch (reply[0]) {
    case ErrorResponse.CODE: {
      const errorResponse = ErrorResponse.parse(reply);
      throw errorResponse;
    }
    case RowDescription.CODE: {
      const rowDescription = RowDescription.parse(reply);
      rowDescriptions.push(rowDescription);
    }
  }
  return new TransformStream<Uint8Array, DataRow>({
    transform(chunk, controller) {
      switch (chunk[0]) {
        case DataRow.CODE: {
          const dataRow = DataRow.parse(chunk);
          controller.enqueue(dataRow);
          break;
        }
        case CommandComplete.CODE: {
          CommandComplete.parse(chunk);
          break;
        }
        case ReadyForQuery.CODE: {
          ReadyForQuery.parse(chunk);
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
  formatCode: 0 | 1 = 0,
): Sequence<TransformStream<Uint8Array, DataRow>> {
  // TODO: this is a minimal implementation that does not handle much yet

  // we can write all of the messages in one shot for efficiency
  yield [
    new Parse("", sql, []).buffer,
    new Describe("S", "").buffer,
    new Bind("", "", parameters, [formatCode]).buffer,
    new Execute("").buffer,
    new Sync().buffer,
    // Flush is not necessary after Sync
    NOREPLY,
  ];

  const parameterDescriptions = new Array<ParameterDescription>();
  const rowDescriptions = new Array<RowDescription>();
  return new TransformStream<Uint8Array, DataRow>({
    transform(message, controller) {
      switch (message[0]) {
        case BindComplete.CODE: {
          BindComplete.parse(message);
          return;
        }
        case ParseComplete.CODE: {
          return;
        }
        case ParameterDescription.CODE: {
          const parameterDescription = ParameterDescription.parse(message);
          parameterDescriptions.push(parameterDescription);
          return;
        }
        case RowDescription.CODE: {
          const rowDescription = RowDescription.parse(message);
          rowDescriptions.push(rowDescription);
          return;
        }
        case ErrorResponse.CODE: {
          const errorResponse = ErrorResponse.parse(message);
          throw errorResponse;
        }
        case DataRow.CODE: {
          const dataRow = DataRow.parse(message);
          controller.enqueue(dataRow);
          return;
        }
        case CommandComplete.CODE: {
          CommandComplete.parse(message);
          return;
        }
        case ReadyForQuery.CODE: {
          ReadyForQuery.parse(message);
          controller.terminate();
          return;
        }
        default: {
          throw new Error(
            `Unexpected packet type ${String.fromCharCode(message[0]!)}`,
          );
        }
      }
    },
  });
}

export async function* prepareSequence(
  sql: string,
  name: string,
): Sequence<{
  parameterDescriptions: ParameterDescription[];
  rowDescriptions: RowDescription[];
}> {
  let reply = yield [
    new Parse(name, sql, []).buffer,
    new Describe("S", name).buffer,
    // Sync will tell Postgres to send a ReadyForQuery when the describe completes
    new Sync().buffer,
  ];

  const parameterDescriptions = new Array<ParameterDescription>();
  const rowDescriptions = new Array<RowDescription>();
  async function* flush(): Sequence<void> {
    while (true) {
      switch (reply[0]) {
        case BindComplete.CODE: {
          BindComplete.parse(reply);
          break;
        }
        case ParseComplete.CODE:
          // ParseComplete is only informative and has no useful data
          ParseComplete.parse(reply);
          break;
        case ParameterDescription.CODE: {
          const parameterDescription = ParameterDescription.parse(reply);
          parameterDescriptions.push(parameterDescription);
          break;
        }
        case RowDescription.CODE: {
          const rowDescription = RowDescription.parse(reply);
          rowDescriptions.push(rowDescription);
          break;
        }
        case ErrorResponse.CODE: {
          const errorResponse = ErrorResponse.parse(reply);
          console.error(errorResponse);
          throw errorResponse;
        }
        case ReadyForQuery.CODE:
        case CommandComplete.CODE:
        case NoData.CODE:
          return;
        default: {
          const type = String.fromCharCode(reply[0]!);
          throw new Error(`Unexpected packet type ${type}`);
        }
      }

      reply = yield SKIP;
    }
  }

  yield* flush();

  return { parameterDescriptions, rowDescriptions };
}

export async function* executePreparedStatementSequence(
  name: string,
  parameters: ReadonlyArray<null | string | Uint8Array>,
  formatCode: 0 | 1 = 0,
): Sequence<TransformStream<Uint8Array, DataRow>> {
  yield [
    new Bind("", name, parameters, [formatCode]).buffer,
    new Execute("").buffer,
    new Sync().buffer,
    // Flush is not necessary after Sync
    NOREPLY,
  ];

  return new TransformStream<Uint8Array, DataRow>({
    transform(message, controller) {
      switch (message[0]) {
        case BindComplete.CODE: {
          BindComplete.parse(message);
          return;
        }
        case ErrorResponse.CODE: {
          const errorResponse = ErrorResponse.parse(message);
          console.error(errorResponse);
          throw errorResponse;
        }
        case DataRow.CODE: {
          const dataRow = DataRow.parse(message);
          controller.enqueue(dataRow);
          return;
        }
        case CommandComplete.CODE: {
          CommandComplete.parse(message);
          return;
        }
        case ReadyForQuery.CODE: {
          ReadyForQuery.parse(message);
          controller.terminate();
          return;
        }
        default: {
          throw new Error(
            `Unexpected packet type ${String.fromCharCode(message[0]!)}`,
          );
        }
      }
    },
  });
}
