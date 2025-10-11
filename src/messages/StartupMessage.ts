import { BinaryWriter } from "../binary-writer";

/**
 * @see {@link https://www.postgresql.org/docs/current/protocol-message-formats.html#PROTOCOL-MESSAGE-FORMATS-STARTUPMESSAGE PostgreSQL Docs}
 */
export function StartupMessage(options: {
  user: string;
  database?: string;
  /** @default false */
  replication?: true | false | "database";
}): Uint8Array {
  const writer = new BinaryWriter();

  // protocol version (3.0)
  writer.writeInt16(3);
  writer.writeInt16(0);

  writer.writeString("user");
  writer.writeString(options.user);

  if (options.database) {
    writer.writeString("database");
    writer.writeString(options.database);
  }

  if (typeof options.replication === "string") {
    writer.writeString("replication");
    writer.writeString(options.replication);
  } else if (typeof options.replication === "boolean") {
    writer.writeString("replication");
    writer.writeString(options.replication ? "true" : "false");
  }

  writer.writeInt8(0);

  // prefix the packet with the packet length
  const lengthWriter = new BinaryWriter(4);
  lengthWriter.writeInt32(4 + writer.byteLength);
  writer.unshift(lengthWriter.buffer);

  return writer.buffer;
}
