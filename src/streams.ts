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
          const position = pending.byteLength;
          pending.resize(pending.byteLength + chunk.byteLength);
          buffer = new Uint8Array(pending);
          buffer.set(chunk, position);
        } else {
          buffer = chunk;
        }

        // process Postgres messages if we at least have a header
        // a single chunk may contain multiple Postgres messages
        // 5 is the minimum size for message header
        while (buffer.byteLength >= 5) {
          // encoded message size +1 for type byte
          const messageSize = getMessageLength(buffer);

          if (buffer.byteLength >= messageSize) {
            // we have a complete Postgres message to emit
            // use subarray to avoid copying the buffer as we split it
            const message = buffer.subarray(0, messageSize);
            controller.enqueue(message);
            buffer = buffer.subarray(messageSize);
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
          pending = new ArrayBuffer(buffer.byteLength, {
            // allow the buffer to resize up to the max
            // resizable buffers do not allocate this space immediately
            maxByteLength: PG_MAX_MESSAGE_SIZE,
          });
          new Uint8Array(pending).set(buffer);
        }
      },
    });
  }
}

function getMessageLength(buffer: Uint8Array): number {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  // encoded message size +1 and offset 1 for type byte
  return view.getUint32(1, false) + 1;
}
