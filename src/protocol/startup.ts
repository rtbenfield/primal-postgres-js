import type { ResolvedConnectionOptions } from "../mod";
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
} from "../protocol.js";
import { Sequence, SKIP } from "../sequence";

const encoder = new TextEncoder();

export async function* startupSequence(
  connection: ResolvedConnectionOptions,
): Sequence<{ parameters: ReadonlyMap<string, string> }> {
  let reply = yield StartupMessage({
    user: connection.username,
    database: connection.database,
    replication: connection.replication,
  });

  const result = authenticationSwitch(reply);
  if (result instanceof AuthenticationOK) {
    // no authentication was required
  } else if (result instanceof AuthenticationSASL) {
    yield* scramSha256Sequence(connection.username, connection.password ?? "");
  }

  reply = yield SKIP;

  const parameters = new Map<string, string>();
  while (reply[0] !== ReadyForQuery.CODE) {
    switch (reply[0]) {
      case BackendKeyData.CODE:
        BackendKeyData.parse(reply);
        break;
      case AuthenticationOK.CODE:
        AuthenticationOK.parse(reply);
        break;
      case ParameterStatus.CODE: {
        const parameter = ParameterStatus.parse(reply);
        parameters.set(parameter.parameter, parameter.value);
        break;
      }
      default:
        console.log("TODO", String.fromCharCode(reply[0]!));
        break;
    }

    reply = yield SKIP;
  }

  ReadyForQuery.parse(reply);
  return { parameters };
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

  const serverFirstMessage = AuthenticationSASLContinue.parse(reply);
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

  const authMessage = `n=${user},r=${clientNonce},${serverFirstMessage.payload},c=biws,r=${serverNonce}`;

  const storedKey = await sha256(clientKey);
  const clientSignature = await hmac(storedKey, authMessage);
  const clientProofBuffer = xor(
    new Uint8Array(clientKey),
    new Uint8Array(clientSignature),
  );
  const clientProof = toBase64(clientProofBuffer);

  reply = yield new SASLResponse(`c=biws,r=${serverNonce},p=${clientProof}`)
    .buffer;

  const serverFinalMessage = AuthenticationSASLFinal.parse(reply);

  // compute the expected server signature
  const serverSignature = await hmac(saltedPassword, "Server Key")
    .then((x) => hmac(x, authMessage))
    .then((x) => toBase64(new Uint8Array(x)));

  // extract the attributes from the server's reply
  const serverFinalAttributes = new Map(
    serverFinalMessage.payload
      .split(",")
      .map((x) => [x[0], x.slice(2)] as const),
  );

  // verify the server's signature against our computed one
  const serverSignatureReply = serverFinalAttributes.get("v");
  if (serverSignature !== serverSignatureReply) {
    console.assert(
      false,
      `Expected ${serverSignature}, got ${serverSignatureReply}`,
    );
    throw new Error("SCRAM-SHA-256 authentication signature failed");
  }

  reply = yield SKIP;
  if (reply[0] !== AuthenticationOK.CODE) {
    throw new Error("SCRAM-SHA-256 authentication failed");
  }
}

async function saltPassword(
  password: string,
  salt: ArrayBuffer,
  iterations: number,
) {
  // convert password to UInt8Array
  const passwordBuffer = encoder.encode(password);

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
      salt,
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
