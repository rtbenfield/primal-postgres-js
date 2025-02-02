import { BinaryReader } from "./binary-reader";
import { BinaryWriter } from "./binary-writer";

/**
 * Hot standby feedback message (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-replication.html#PROTOCOL-REPLICATION-HOT-STANDBY-FEEDBACK-MESSAGE PostgreSQL Docs}
 */
export class HotStandbyFeedback {
  static get CODE() {
    // 'h'
    return 0x68 as const;
  }

  constructor(
    public lsn: bigint,
    /** The client's system clock at the time of transmission, as microseconds since midnight on 2000-01-01. */
    public clientSystemClock: bigint,
    /**
     * The standby's current global xmin, excluding the catalog_xmin from any replication slots.
     * If both this value and the following catalog_xmin are 0, this is treated as a notification that hot standby feedback will no longer be sent on this connection.
     * Later non-zero messages may reinitiate the feedback mechanism.
     */
    public xmin: number,
    /** The epoch of the global xmin xid on the standby. */
    public xminEpoch: number,
    /** The lowest catalog_xmin of any replication slots on the standby. Set to 0 if no catalog_xmin exists on the standby or if hot standby feedback is being disabled. */
    public catalogXmin: number,
    /** The epoch of the catalog_xmin xid on the standby. */
    public catalogXminEpoch: number,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(HotStandbyFeedback.CODE);
    writer.writeInt64(this.lsn);
    writer.writeInt64(this.clientSystemClock);
    writer.writeInt32(this.xmin);
    writer.writeInt32(this.xminEpoch);
    writer.writeInt32(this.catalogXmin);
    writer.writeInt32(this.catalogXminEpoch);
    return writer.buffer;
  }
}

/**
 * Primary keepalive message (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-replication.html#PROTOCOL-REPLICATION-PRIMARY-KEEPALIVE-MESSAGE PostgreSQL Docs}
 */
export class PrimaryKeepalive {
  static get CODE() {
    // 'k'
    return 0x6b as const;
  }

  constructor(
    public lsn: bigint,
    /** Microseconds since 2000-01-01 */
    public serverSystemClock: bigint,
    public acknowledge: boolean,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === PrimaryKeepalive.CODE,
      `Expected 'k', got ${String.fromCharCode(code)}`,
    );
    const lsn = reader.readInt64();
    const serverSystemClock = reader.readInt64();
    const acknowledge = reader.readByte();
    console.assert(
      acknowledge === 0 || acknowledge === 1,
      `Expected 0 or 1, got ${acknowledge}`,
    );
    return new PrimaryKeepalive(lsn, serverSystemClock, acknowledge === 1);
  }
}

/**
 * Standby status update (F)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-replication.html#PROTOCOL-REPLICATION-STANDBY-STATUS-UPDATE PostgreSQL Docs}
 */
export class StandbyStatusUpdate {
  static get CODE() {
    // 'r'
    return 0x72 as const;
  }

  constructor(
    /** The location of the last WAL byte + 1 received and written to disk in the standby. */
    public confirmedLsn: bigint,
    /** The location of the last WAL byte + 1 flushed to disk in the standby. */
    public flushedLsn: bigint,
    /** The location of the last WAL byte + 1 applied in the standby. */
    public appliedLsn: bigint,
    /** The client's system clock at the time of transmission, as microseconds since midnight on 2000-01-01. */
    public clientSystemClock: bigint,
    /** If 1, the client requests the server to reply to this message immediately. This can be used to ping the server, to test if the connection is still healthy. */
    public requestReply: boolean,
  ) {}

  get buffer() {
    const writer = new BinaryWriter();
    writer.writeByte(StandbyStatusUpdate.CODE);
    writer.writeInt64(this.confirmedLsn);
    writer.writeInt64(this.flushedLsn);
    writer.writeInt64(this.appliedLsn);
    writer.writeInt64(this.clientSystemClock);
    writer.writeByte(this.requestReply ? 1 : 0);
    return writer.buffer;
  }
}

/**
 * XLogData (B)
 *
 * @see {@link https://www.postgresql.org/docs/current/protocol-replication.html#PROTOCOL-REPLICATION-XLOGDATA PostgreSQL Docs}
 */
export class XLogData {
  static get CODE() {
    // 'w'
    return 0x77 as const;
  }

  constructor(
    public startLsn: bigint,
    public endLsn: bigint,
    public serverSystemClock: bigint,
    public walData: Uint8Array,
  ) {}

  static parse(buffer: Uint8Array) {
    const reader = new BinaryReader(buffer);
    const code = reader.readByte();
    console.assert(
      code === XLogData.CODE,
      `Expected 'w', got ${String.fromCharCode(code)}`,
    );
    const startLsn = reader.readInt64();
    const endLsn = reader.readInt64();
    const serverSystemClock = reader.readInt64();
    const walData = reader.rest;
    return new XLogData(startLsn, endLsn, serverSystemClock, walData);
  }
}

/**
 * Converts a PostgreSQL microseconds timestamp to a Date object. Some loss of
 * precision may occur since JavaScript Date objects only support milliseconds.
 *
 * @param microseconds microseconds since 2000-01-01
 * @returns Date object
 */
export function microsecondsToDate(microseconds: bigint): Date {
  const milliseconds = Number(microseconds / 1000n);
  return new Date(milliseconds + Date.UTC(2000, 0, 1));
}

/**
 * Converts a JavaScript Date object to a PostgreSQL microseconds timestamp.
 * The timestamp is the number of microseconds since 2000-01-01.
 *
 * @param date Date value to convert
 * @returns microseconds since 2000-01-01
 */
export function dateToMicroseconds(date: Date): bigint {
  const milliseconds = date.getTime();
  return BigInt(milliseconds) * BigInt(1000);
}
