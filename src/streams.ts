/**
 * The maximum size of a Postgres message (1GB).
 *
 * There is not a specific limit on the size of a Postgres message, but
 * there is a practical limit based on technical constraints of the Postgres
 * implementation details.
 */
const PG_MAX_MESSAGE_SIZE = 1073741824;

/**
 * Postgres will sometimes batch multiple messages into a single packet.
 * Similarly, some packets may be split into multiple TCP messages.
 *
 * To simplify downstream processing, this transformer aligns packets before
 * enqueuing them for the next consumer.
 */
export class PostgresAlignmentStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor() {
    //! this TransformStream is performance sensitive since it runs for every
    //! TCP message that is received on the Socket

    // resizable buffer for incomplete messages
    // a resizable buffer eliminates the need to copy previous data when
    // concatenating another chunk into the pending buffer
    let pending: ArrayBuffer | null = null;

    super({
      transform(chunk, controller) {
        // if we have pending data, combine it with the new chunk
        let buffer: Uint8Array;
        if (pending) {
          /**
           * Unfortunately, there is no zero-copy way to concatenate ArrayBuffer
           * instances yet. This approach is as close as we can get by only
           * copying the new chunk into the existing pending buffer. This
           * effectively allows the chunk to be GC'd between transforms. Compare
           * this to an array of Uint8Array chunks that are combined JIT. The
           * concatenation would cause a minium of 2x memory usage and fail to
           * distribute the CPU work over the duration of the stream.
           */
          buffer = extendAndCopy(pending, chunk);
        } else {
          buffer = chunk;
        }

        // process Postgres messages if we at least have a header
        // a single chunk may contain multiple Postgres messages
        // 5 is the minimum size for message header
        while (buffer.byteLength >= 5) {
          // encoded message length + 1 for type byte
          const messageLength = getMessageLength(buffer);

          if (buffer.byteLength === messageLength) {
            // we have a complete Postgres message to emit
            // the buffer is the exact size, so we don't need to partition it
            controller.enqueue(buffer);
            // if we can emit a message, we can reset the pending buffer
            pending = null;
            // break out of the entire flow to avoid needing to reassign buffer
            return;
          } else if (buffer.byteLength >= messageLength) {
            // we have a complete Postgres message to emit
            // split the message from the remaining bytes of the buffer
            const { message, remaining } = partitionMessage(
              buffer,
              messageLength,
            );
            controller.enqueue(message);
            buffer = remaining;
            // if we can emit a message, we can reset the pending buffer
            pending = null;
          } else {
            // Postgres message is incomplete
            break;
          }
        }

        // hold any remaining bytes to concat with the next chunk
        if (buffer.byteLength > 0 && !pending) {
          // copy the remaining bytes into a new resizable ArrayBuffer
          // we do not reuse the previous buffer because it is used downstream
          pending = cloneToResizableBuffer(buffer);
        }
      },
    });
  }
}

/**
 * Clones the specified buffer into a new resizable ArrayBuffer, copying the
 * bytes into it the new buffer in the process. This is used to convert a
 * fixed size ArrayBuffer into a resizable one with a maximum size of
 * `PG_MAX_MESSAGE_SIZE`.
 */
function cloneToResizableBuffer(buffer: Uint8Array): ArrayBuffer {
  // copy the remaining bytes into a new resizable ArrayBuffer
  // we do not reuse the previous buffer because it is used downstream
  const resizable = new ArrayBuffer(buffer.byteLength, {
    // allow the buffer to resize up to the max
    // resizable buffers do not allocate this space immediately
    maxByteLength: PG_MAX_MESSAGE_SIZE,
  });
  new Uint8Array(resizable).set(buffer);
  return resizable;
}

function getMessageLength(buffer: Uint8Array): number {
  // mimic readUint32 from offset=1 without the overhead of a DataView
  // add 1 for the header that we skip with the offset
  return (
    1 +
    ((buffer[1]! << 24) | (buffer[2]! << 16) | (buffer[3]! << 8) | buffer[4]!)
  );
}

/**
 * Extends an existing resizable ArrayBuffer and copies the specified chunk
 * into it at the end.
 */
function extendAndCopy(existing: ArrayBuffer, chunk: Uint8Array): Uint8Array {
  const position = existing.byteLength;
  existing.resize(existing.byteLength + chunk.byteLength);
  const buffer = new Uint8Array(existing);
  buffer.set(chunk, position);
  return buffer;
}

/**
 * Splits the specified buffer into two parts based on the specified message
 * length.
 */
function partitionMessage(buffer: Uint8Array, messageLength: number) {
  const message = buffer.subarray(0, messageLength);
  const remaining = buffer.subarray(messageLength);
  return { message, remaining };
}
