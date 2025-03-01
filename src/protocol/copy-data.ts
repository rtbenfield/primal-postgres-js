import { Logger } from "../logger";
import { Socket } from "../mod";
import {
  CommandComplete,
  CopyData,
  CopyDone,
  CopyFail,
  CopyInResponse,
  ErrorResponse,
  Query,
} from "../protocol";

export async function copyData(
  socket: Socket,
  query: string,
  stdin: ReadableStream<Uint8Array>,
  logger: Logger,
) {
  const writer = socket.writable.getWriter();
  try {
    // send the COPY statement
    await writer.write(new Query(query).buffer);
    // wait for the server to acknowledge the copy
    await waitForCopyBoth(socket.readable);
    try {
      // stream each chunk as a CopyData message
      for await (const chunk of stdin) {
        const copyData = new CopyData(chunk);
        logger.debug("--> [d]", { buffer: copyData.buffer });
        await writer.write(copyData.buffer);
      }
      // complete the stream with a CopyDone message
      await writer.write(new CopyDone().buffer);
    } catch (error) {
      // if an error occurs, send a CopyFail message to cancel the copy
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await writer.write(new CopyFail(errorMessage).buffer);
      throw error;
    }
    // wait for the server to confirm the copy is complete
    await waitForCommandComplete(socket.readable);
  } finally {
    writer.releaseLock();
  }
}

async function waitForCopyBoth(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  try {
    let result = await reader.read();
    while (result.value) {
      switch (result.value[0]) {
        case CopyInResponse.CODE:
          return CopyInResponse.parse(result.value);
        case ErrorResponse.CODE:
          throw ErrorResponse.parse(result.value);
      }
      result = await reader.read();
    }
    throw new Error("Connection closed unexpectedly");
  } finally {
    reader.releaseLock();
  }
}

async function waitForCommandComplete(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  try {
    let result = await reader.read();
    while (result.value) {
      switch (result.value[0]) {
        case CommandComplete.CODE:
          return CommandComplete.parse(result.value);
        case ErrorResponse.CODE:
          throw ErrorResponse.parse(result.value);
      }
      result = await reader.read();
    }
    throw new Error("Connection closed unexpectedly");
  } finally {
    reader.releaseLock();
  }
}
