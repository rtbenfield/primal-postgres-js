import {
  Begin,
  Commit,
  Delete,
  Insert,
  Origin,
  Relation,
  TupleData,
  Type,
  Update,
} from "./pgoutput";
import { CopyBothResponse, CopyData, ErrorResponse } from "./protocol";
import { microsecondsToDate, PrimaryKeepalive, XLogData } from "./replication";
import { TypeParser } from "./types/mod";

/**
 * A transform stream that decodes pgoutput messages into JavaScript objects.
 */
export class PgoutputDecoderStream extends TransformStream<
  Uint8Array,
  unknown
> {
  constructor(types: TypeParser) {
    const relations = new Map<number, Relation>();

    function decodeTupleData(tupleData: TupleData, relation: Relation) {
      const columns = relation.columns.map((c) => {
        const decoder = types.getType(c.type).decode;
        return {
          decoder,
          name: c.name,
        };
      });
      return Object.fromEntries(
        tupleData.columns.map((value, i) => {
          const col = columns.at(i);
          if (!col) {
            throw new PgoutputDecoderError(
              `column ${i} not found in relation ${relation.name}`,
            );
          }

          switch (value.type) {
            case 0x63 /* 'n' NULL */:
              return [col.name, null];
            case 0x75 /* 'u' TOASTed value */:
              // TODO: what do we do here?
              return [col.name, value.value];
            case 0x74 /* 't' text */:
              if (types.type !== "text") {
                throw new PgoutputDecoderError(
                  `expected binary encoded values, got text`,
                );
              }
              // TODO: fix text decoding
              return [col.name, value.value];
            case 0x62 /* 'b' binary */:
              if (types.type !== "binary") {
                throw new PgoutputDecoderError(
                  `expected text encoded values, got binary`,
                );
              }
              const decoded = col.decoder(value.value, types);
              return [col.name, decoded];
            default:
              throw new PgoutputDecoderError(
                // @ts-expect-error
                `unknown value type ${String.fromCharCode(value.type)}`,
              );
          }
        }),
      );
    }

    super({
      transform(chunk, controller) {
        const downstream = handleChunk(chunk);
        if (downstream instanceof PrimaryKeepalive || downstream === null) {
          return;
        }

        const { xlog, walData } = downstream;
        if (walData instanceof Relation) {
          relations.set(walData.oid, walData);
        } else if (walData instanceof Insert) {
          const relation = relations.get(walData.relationOid);
          if (!relation) {
            throw new Error(`unknown relation ${walData.relationOid}`);
          }
          const inserted = decodeTupleData(walData.tupleData, relation);
          controller.enqueue({
            type: "insert",
            lsn: xlog.endLsn,
            schema: relation.namespace,
            relation: relation.name,
            timestamp: microsecondsToDate(xlog.serverSystemClock),
            inserted,
          });
        } else if (walData instanceof Update) {
          const relation = relations.get(walData.relationOid);
          if (!relation) {
            throw new Error(`unknown relation ${walData.relationOid}`);
          }
          const before = walData.oldTupleData
            ? decodeTupleData(walData.oldTupleData, relation)
            : null;
          const after = decodeTupleData(walData.newTupleData, relation);
          controller.enqueue({
            type: "update",
            lsn: xlog.endLsn,
            schema: relation.namespace,
            relation: relation.name,
            timestamp: microsecondsToDate(xlog.serverSystemClock),
            before,
            after,
          });
        } else if (walData instanceof Delete) {
          const relation = relations.get(walData.relationOid);
          if (!relation) {
            throw new Error(`unknown relation ${walData.relationOid}`);
          }
          const deleted = decodeTupleData(walData.tupleData, relation);
          controller.enqueue({
            type: "delete",
            lsn: xlog.endLsn,
            schema: relation.namespace,
            relation: relation.name,
            timestamp: microsecondsToDate(xlog.serverSystemClock),
            deleted,
          });
        }
      },
    });
  }
}

function handleChunk(chunk: Uint8Array) {
  switch (chunk.at(0)) {
    case CopyBothResponse.CODE:
      return null;
    case CopyData.CODE:
      const copyData = CopyData.parse(chunk);
      const message = matchReplicationMessage(copyData.data);
      if (message instanceof PrimaryKeepalive) {
        return message;
      } else {
        return {
          xlog: message,
          walData: matchLogicalReplicationData(message.walData),
        };
      }
    case ErrorResponse.CODE:
      throw ErrorResponse.parse(chunk);
    default:
      throw new PgoutputDecoderError(
        `invalid message code ${String.fromCharCode(chunk.at(0)!)}`,
      );
  }
}

function matchReplicationMessage(data: Uint8Array) {
  switch (data.at(0)) {
    case PrimaryKeepalive.CODE:
      return PrimaryKeepalive.parse(data);
    case XLogData.CODE:
      return XLogData.parse(data);
    default:
      throw new PgoutputDecoderError(
        `invalid message code ${String.fromCharCode(data.at(0)!)}`,
      );
  }
}

export class PgoutputDecoderError extends Error {}

function matchLogicalReplicationData(data: Uint8Array) {
  switch (data.at(0)) {
    case Begin.CODE:
      return Begin.parse(data);
    case Commit.CODE:
      return Commit.parse(data);
    case Origin.CODE:
      return Origin.parse(data);
    case Relation.CODE:
      return Relation.parse(data);
    case Type.CODE:
      return Type.parse(data);
    case Insert.CODE:
      return Insert.parse(data);
    case Update.CODE:
      return Update.parse(data);
    case Delete.CODE:
      return Delete.parse(data);
    default:
      throw new PgoutputDecoderError(
        `unexpected pgoutput message type ${String.fromCharCode(data.at(0)!)}`,
      );
  }
}
