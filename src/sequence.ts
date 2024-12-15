import { BinaryReader } from "./binary-reader";
import type { ResolvedConnectionOptions, Socket } from "./mod";
import {
  AuthenticationOK,
  AuthenticationSASL,
  AuthenticationSASLContinue,
  AuthenticationSASLFinal,
  authenticationSwitch,
  BackendKeyData,
  ParameterStatus,
  ReadyForQuery,
  SASLInitialResponse,
  SASLResponse,
  StartupMessage,
} from "./protocol";

/**
 * Postgres will sometimes batch multiple messages into a single packet.
 * To simplify downstream processing, this transformer splits them before
 * enqueuing them for the next consumer.
 */
class PostgresMessageSplitStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor() {
    super({
      transform(chunk, controller) {
        let buffer = chunk;

        while (buffer.byteLength > 0) {
          const reader = new BinaryReader(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength,
          );
          reader.readByte();
          const packetLength = reader.readInt32() + 1;
          const packet = buffer.subarray(0, packetLength);
          controller.enqueue(packet);
          buffer = buffer.subarray(packetLength);
        }
      },
    });
  }
}

export async function executeSequence<T extends Sequence<unknown>>(
  socket: Socket,
  sequence: T,
) {
  const { readable, writable } = socket;
  const writer = writable.getWriter();
  try {
    const reader = readable
      .pipeThrough(new PostgresMessageSplitStream())
      .getReader();
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
        console.debug("...waiting for reply...");
        const inbox = await reader.read();
        if (inbox.done) {
          throw new Error("Connection closed unexpectedly");
        }
        const firstByte = String.fromCharCode(inbox.value.at(0)!);
        console.debug(`<-- [${firstByte}]`, Buffer.from(inbox.value));
        // pass the repy packet back into the sequence
        outbox = await sequence.next(inbox.value);
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    writer.releaseLock();
  }
}

export const SKIP = Symbol("skip");
export type Sequence<T> = AsyncGenerator<
  Uint8Array | typeof SKIP,
  T,
  Uint8Array
>;

export async function* startupSequence(
  connection: ResolvedConnectionOptions,
): Sequence<void> {
  let reply = yield StartupMessage({
    user: connection.username,
    database: connection.database,
    replication: connection.replication,
  });

  const result = authenticationSwitch(reply.buffer);
  if (result instanceof AuthenticationOK) {
    // authentication is complete
    reply = yield SKIP;
  } else if (result instanceof AuthenticationSASL) {
    yield* scramSha256Sequence(connection.username, connection.password ?? "");
  }
}

/**
 * @see {@link https://www.postgresql.org/docs/current/sasl-authentication.html#SASL-SCRAM-SHA-256 PostgreSQL Docs}
 */
async function* scramSha256Sequence(
  user: string,
  password: string,
): Sequence<void> {
  const clientNonce = toBase64(crypto.getRandomValues(new Uint8Array(18)));
  let reply = yield new SASLInitialResponse(
    "SCRAM-SHA-256",
    `n,,n=${user},r=${clientNonce}`,
  ).buffer;

  const serverFirstMessage = AuthenticationSASLContinue.parse(reply.buffer);
  const attributes = new Map(
    serverFirstMessage.payload
      .split(",")
      .map((x) => [x[0], x.slice(2)] as const),
  );
  const serverNonce = attributes.get("r");
  const salt = attributes.get("s");
  const iterations = parseInt(attributes.get("i")!, 10);
  if (!serverNonce || !salt || !iterations) {
    throw new Error("SCRAM-SHA-256 authentication failed");
  }

  const saltedPassword = await saltPassword(
    password,
    fromBase64(salt).buffer,
    iterations,
  );
  const clientKey = await hmac(saltedPassword, "Client Key");

  const authMessage = `n=${user},r=${clientNonce},r=${serverNonce},s=${salt},i=${iterations},c=biws,r=${serverNonce}`;

  const storedKey = await sha256(clientKey);
  const clientSignature = await hmac(storedKey, authMessage);
  const clientProofBuffer = xor(
    new Uint8Array(clientKey),
    new Uint8Array(clientSignature),
  );
  const clientProof = toBase64(clientProofBuffer);

  reply = yield new SASLResponse(`c=biws,r=${serverNonce},p=${clientProof}`)
    .buffer;

  const serverFinalMessage = AuthenticationSASLFinal.parse(reply.buffer);

  // verify the server's signature in reply
  const serverSignature = await hmac(saltedPassword, "Server Key")
    .then((x) => hmac(x, authMessage))
    .then((x) => toBase64(new Uint8Array(x)));
  const serverSignatureReply = serverFinalMessage.payload
    .split(String.fromCharCode(0), 1)
    .at(0)!
    .slice(2);
  // TODO: why does the reply signature always has a trailing 'R' that ours does not?
  // if (serverSignature !== serverSignatureReply) {
  //   throw new Error("SCRAM-SHA-256 authentication signature failed");
  // }

  reply = yield SKIP;

  while (reply.at(0) !== ReadyForQuery.CODE) {
    switch (reply.at(0)) {
      case 0x4b: // 'K'
        console.log(
          "TODO",
          BackendKeyData.parse(
            reply.buffer.slice(
              reply.byteOffset,
              reply.byteOffset + reply.byteLength,
            ),
          ),
        );
        break;
      case 0x52:
        console.log(
          "TODO",
          AuthenticationOK.parse(
            reply.buffer.slice(
              reply.byteOffset,
              reply.byteOffset + reply.byteLength,
            ),
          ),
        );
        break;
      case 0x53: // 'S'
        console.log(
          "TODO",
          ParameterStatus.parse(
            reply.buffer.slice(
              reply.byteOffset,
              reply.byteOffset + reply.byteLength,
            ),
          ),
        );
        break;
      default:
        console.log("TODO", String.fromCharCode(reply.at(0)!));
    }

    reply = yield SKIP;
  }

  const ready = ReadyForQuery.parse(
    reply.buffer.slice(reply.byteOffset, reply.byteOffset + reply.byteLength),
  );
  console.log("READY", ready);
}

async function saltPassword(
  password: string,
  salt: ArrayBuffer,
  iterations: number,
) {
  const encoder = new TextEncoder();

  // convert password to UInt8Array
  const passwordBuffer =
    typeof password === "string" ? encoder.encode(password) : password;

  // convert salt to UInt8Array
  const saltBuffer = typeof salt === "string" ? encoder.encode(salt) : salt;

  // import the password as a CryptoKey
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  // derive the bits using PBKDF2
  return await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
}

async function hmac(key: ArrayBuffer, message: string | ArrayBuffer) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buffer =
    typeof message === "string" ? new TextEncoder().encode(message) : message;
  return await crypto.subtle.sign("HMAC", cryptoKey, buffer);
}

async function sha256(buffer: ArrayBuffer) {
  return await crypto.subtle.digest("SHA-256", buffer);
}

function fromBase64(value: string) {
  return new Uint8Array(Array.from(atob(value), (c) => c.charCodeAt(0)));
}

function toBase64(buffer: Uint8Array) {
  return btoa(String.fromCharCode(...buffer));
}

function xor(a: Uint8Array, b: Uint8Array) {
  console.assert(
    a.byteLength === b.byteLength,
    "Buffers must be the same size",
  );
  const result = new Uint8Array(a.byteLength);
  for (let i = 0; i < a.byteLength; i++) {
    result[i] = a[i]! ^ b[i]!;
  }
  return result;
}
