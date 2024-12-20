import type { Socket } from "./mod";

export async function executeSequence<T>(
  socket: Socket,
  sequence: Sequence<T>,
) {
  const { readable, writable } = socket;
  const writer = writable.getWriter();
  try {
    const reader = readable.getReader();
    try {
      // get the first packet
      let outbox = await sequence.next();
      while (!outbox.done) {
        if (outbox.value !== SKIP) {
          // send the packet to the database
          const firstByte = String.fromCharCode(outbox.value.at(0)!);
          console.debug(`--> [${firstByte}]`, Buffer.from(outbox.value));
          await writer.write(outbox.value);
        }
        // receive the next packet
        // console.debug("...waiting for reply...");
        const inbox = await reader.read();
        if (inbox.done) {
          throw new Error("Connection closed unexpectedly");
        }
        const firstByte = String.fromCharCode(inbox.value.at(0)!);
        console.debug(`<-- [${firstByte}]`, Buffer.from(inbox.value));
        // pass the repy packet back into the sequence
        outbox = await sequence.next(inbox.value);
      }
      return outbox.value;
    } finally {
      reader.releaseLock();
    }
  } finally {
    writer.releaseLock();
  }
}

export async function executeSequenceStream<T>(
  socket: Socket,
  sequence: Sequence<TransformStream<Uint8Array, T>>,
): Promise<ReadableStream<T>> {
  const transformer = await executeSequence(socket, sequence);

  const { readable, writable } = socket;
  const writer = writable.getWriter();
  try {
    const reader = readable.getReader();
    try {
      return new ReadableStream<Uint8Array>({
        cancel() {
          console.debug("------- sequence complete");
          writer.releaseLock();
          reader.releaseLock();
        },
        async pull(controller) {
          const nextResult = await reader.read();
          if (nextResult.done) {
            throw new Error(`connection was closed unexpectedly`);
          }
          controller.enqueue(nextResult.value);
        },
      }).pipeThrough(transformer);
    } catch (e) {
      reader.releaseLock();
      throw e;
    }
  } catch (e) {
    writer.releaseLock();
    throw e;
  }
}

export const SKIP = Symbol("skip");
export type Sequence<T> = AsyncGenerator<
  Uint8Array | typeof SKIP,
  T,
  Uint8Array
>;
