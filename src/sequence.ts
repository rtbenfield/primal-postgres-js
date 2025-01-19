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
        let noreply = false;

        if (outbox.value instanceof Uint8Array) {
          // send the packet to the database
          const firstByte = String.fromCharCode(outbox.value.at(0)!);
          console.debug(`--> [${firstByte}]`, Buffer.from(outbox.value));
          await writer.write(outbox.value);
        } else if (outbox.value !== SKIP) {
          // outbox.value must be ReadonlyArray<Uint8Array>
          // Array.isArray turns the type into an `any` 😞

          // debug only
          for (const message of outbox.value) {
            if (message === NOREPLY) {
              noreply = true;
            } else {
              const firstByte = String.fromCharCode(message.at(0)!);
              console.debug(`--> [${firstByte}]`, Buffer.from(message));
            }
          }

          // we can write all of the messages in one shot for efficiency
          await writer.write(
            new Uint8Array(
              combineArrayBuffers(...outbox.value.filter((x) => x !== NOREPLY)),
            ),
          );

          // if any NOREPLY was included in the array, we skip the next inbound message
          noreply = outbox.value.some((x) => x === NOREPLY);
        }

        // receive the next message
        if (!noreply) {
          // console.debug("...waiting for reply...");
          const inbox = await reader.read();
          if (inbox.done) {
            throw new Error("Connection closed unexpectedly");
          }
          const firstByte = String.fromCharCode(inbox.value.at(0)!);
          console.debug(`<-- [${firstByte}]`, Buffer.from(inbox.value));
          // pass the repy message back into the sequence
          outbox = await sequence.next(inbox.value);
        } else {
          console.debug("--- noreply ---");
          outbox = await sequence.next();
        }
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
          const firstByte = String.fromCharCode(nextResult.value.at(0)!);
          console.debug(`<-- [${firstByte}]`, Buffer.from(nextResult.value));
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

/**
 * Symbol that is yielded by a sequence to skip sending a packet and wait
 * for the next inbound packet instead.
 */
export const SKIP = Symbol("skip");

/**
 * Symbol that is yielded by a sequence to skip receiving a packet and proceed
 * with the sequence instead. This is with `executeSequenceStream` to push the
 * next packet into the `TransformStream` returned by the sequence.
 */
export const NOREPLY = Symbol("noreply");

export type Sequence<T> = AsyncGenerator<
  Uint8Array | ReadonlyArray<Uint8Array | typeof NOREPLY> | typeof SKIP,
  T,
  Uint8Array
>;

/**
 * Combines an array of ArrayBuffer objects into a single ArrayBuffer.
 * Note that this method is not yet zero-copy.
 * Unfortunately, there is no zero-copy support in ArrayBufer yet.
 * @param buffers An array of ArrayBuffer or ArrayBufferView objects to combine.
 * @returns A single ArrayBuffer concatenating all the input buffers.
 */
function combineArrayBuffers(
  ...buffers: ReadonlyArray<ArrayBufferLike | ArrayBufferView>
): ArrayBuffer {
  const totalLength = buffers.reduce(
    (sum, buffer) => sum + buffer.byteLength,
    0,
  );
  const combinedBuffer = new ArrayBuffer(totalLength);
  const combinedView = new Uint8Array(combinedBuffer);
  let offset = 0;
  for (const buffer of buffers) {
    const view = new Uint8Array(
      ArrayBuffer.isView(buffer) ? buffer.buffer : buffer,
    );
    combinedView.set(view, offset);
    offset += view.length;
  }
  return combinedBuffer;
}
