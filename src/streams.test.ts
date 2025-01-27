import { describe, expect, it } from "vitest";
import { PostgresAlignmentStream } from "./streams";

describe.only("PostgresAlignmentStream", () => {
  it(
    "processes multiple chunks with single messages",
    { timeout: 100 },
    async () => {
      const stream = new PostgresAlignmentStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Create two simple messages
      const message1 = createMessage(1, new Uint8Array([1, 2, 3]));
      const message2 = createMessage(2, new Uint8Array([4, 5, 6]));

      // Write messages in separate chunks
      void writer.write(message1);
      void writer.write(message2);
      void writer.close();

      // Read and verify messages
      const result1 = await reader.read();
      const result2 = await reader.read();
      const done = await reader.read();

      expect(result1.value).toEqual(message1);
      expect(result2.value).toEqual(message2);
      expect(done.done).toBe(true);
    },
  );

  it(
    "processes a single chunk with multiple messages",
    { timeout: 100 },
    async () => {
      const stream = new PostgresAlignmentStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Create two messages and concatenate them
      const message1 = createMessage(1, new Uint8Array([1, 2, 3]));
      const message2 = createMessage(2, new Uint8Array([4, 5, 6]));
      const combinedChunk = new Uint8Array(message1.length + message2.length);
      combinedChunk.set(message1, 0);
      combinedChunk.set(message2, message1.length);

      // Write both messages in a single chunk
      void writer.write(combinedChunk);
      void writer.close();

      // Read and verify messages
      const result1 = await reader.read();
      const result2 = await reader.read();
      const done = await reader.read();

      expect(result1.value).toEqual(message1);
      expect(result2.value).toEqual(message2);
      expect(done.done).toBe(true);
    },
  );

  it(
    "processes a message split across multiple chunks",
    { timeout: 100 },
    async () => {
      const stream = new PostgresAlignmentStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Create a message
      const message = createMessage(1, new Uint8Array([1, 2, 3, 4, 5, 6]));

      // Split the message into three parts:
      // 1. Part of header
      // 2. Rest of header + part of payload
      // 3. Rest of payload
      const chunk1 = message.subarray(0, 3);
      const chunk2 = message.subarray(3, 7);
      const chunk3 = message.subarray(7);

      // Write chunks separately
      void writer.write(chunk1);
      void writer.write(chunk2);
      void writer.write(chunk3);
      void writer.close();

      // Read and verify message
      const result = await reader.read();
      const done = await reader.read();

      expect(result.value).toEqual(message);
      expect(done.done).toBe(true);
    },
  );

  it(
    "processes overlapping messages with header split",
    { timeout: 100 },
    async () => {
      const stream = new PostgresAlignmentStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Create three messages
      const message1 = createMessage(1, new Uint8Array([1, 2, 3]));
      const message2 = createMessage(2, new Uint8Array([4, 5, 6, 7, 8]));
      const message3 = createMessage(3, new Uint8Array([9, 10, 11]));

      // First chunk: full message1 + partial message2 (cut at 3 bytes into header)
      const chunk1 = new Uint8Array(message1.length + 3);
      chunk1.set(message1, 0);
      chunk1.set(message2.subarray(0, 3), message1.length);

      // Second chunk: rest of message2 + full message3
      const chunk2 = new Uint8Array(message2.length - 3 + message3.length);
      chunk2.set(message2.subarray(3), 0);
      chunk2.set(message3, message2.length - 3);

      // Write chunks
      void writer.write(chunk1);
      void writer.write(chunk2);
      void writer.close();

      // Read and verify messages
      const result1 = await reader.read();
      const result2 = await reader.read();
      const result3 = await reader.read();
      const done = await reader.read();

      expect(result1.value).toEqual(message1);
      expect(result2.value).toEqual(message2);
      expect(result3.value).toEqual(message3);
      expect(done.done).toBe(true);
    },
  );
});

function createMessage(messageType: number, payload: Uint8Array): Uint8Array {
  // Message format: [type (1 byte)][length (4 bytes)][payload]
  // Length includes the length field itself (4 bytes) and payload length
  const messageLength = 4 + payload.byteLength;
  const message = new Uint8Array(1 + messageLength);
  message[0] = messageType;

  // Set length in big-endian format
  const view = new DataView(message.buffer);
  view.setUint32(1, messageLength, false);

  // Copy payload
  message.set(payload, 5);
  return message;
}
