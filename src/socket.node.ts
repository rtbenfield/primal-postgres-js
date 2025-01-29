import { connect } from "node:net";
import { Readable, Writable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import type { Socket } from "./mod";

/**
 * An adapter for a Node.js `net.Socket` to the `Socket` interface.
 */
export class NodeSocket implements Socket {
  readonly #connected: Promise<void>;
  readonly #socket;
  readonly #readable;
  readonly #writable;

  constructor(hostname: string, port: number) {
    this.#socket = connect({
      host: hostname,
      port,
    });

    this.#connected = new Promise((resolve, reject) => {
      this.#socket.once("connect", () => resolve());
      this.#socket.once("error", (e) => reject(e));
    });

    this.#readable = Readable.toWeb(this.#socket) as ReadableStream<Uint8Array>;
    this.#writable = Writable.toWeb(this.#socket) as WritableStream<Uint8Array>;
  }

  get connected() {
    return this.#connected;
  }

  get readable() {
    return this.#readable;
  }

  get writable() {
    return this.#writable;
  }
}
