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
    // buffer for incomplete messages
    let pending: Uint8Array | null = null;

    super({
      transform(chunk, controller) {
        // if we have pending data, combine it with the new chunk
        let buffer: Uint8Array;
        if (pending) {
          // TODO: this implementation fully copies both buffers
          // could ArrayBuffer.resize() be more efficient here?
          buffer = new Uint8Array(pending.byteLength + chunk.byteLength);
          buffer.set(pending, 0);
          buffer.set(chunk, pending.byteLength);
          // reset the pending buffer
          pending = null;
        } else {
          buffer = chunk;
        }

        // process Postgres messages if we at least have a header
        // a single chunk may contain multiple Postgres messages
        while (buffer.byteLength >= 5) {
          // minimum size for message header
          const view = new DataView(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
          );
          // encoded message size +1 for type byte
          const messageSize = view.getUint32(1, false) + 1;

          if (buffer.byteLength >= messageSize) {
            // we have a complete Postgres message to emit
            // use subarray to avoid copying the buffer as we split it
            const message = buffer.subarray(0, messageSize);
            controller.enqueue(message);
            buffer = buffer.subarray(messageSize);
          } else {
            // Postgres message is incomplete, so break the while loop
            pending = buffer;
            break;
          }
        }

        // hold any remaining bytes to concat with the next chunk
        if (buffer.byteLength > 0 && !pending) {
          pending = buffer;
        }
      },
    });
  }
}
