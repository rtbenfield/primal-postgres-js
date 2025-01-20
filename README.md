# PrimalJS Postgres Driver

> ![WARNING] > `@primaljs/postgres` is a work in progress. It is not intended for production use.

The PrimalJS Postgres Driver is a runtime agnostic, standards-first database driver for [Postgres](https://www.postgresql.org/). It starts from scratch, building on Web APIs and modern JavaScript features to provide an excellent developer experience while supporting advanced use cases.

Some things that make the PrimalJS Postgres Driver different:

- Tree-shakeable and ESM compatible.
- Streaming-first API, with the option to eagerly load into memory.
- Built on `Uint8Array` instead of `Buffer`, so no reliance on Node polyfills.
- TCP socket abstraction built on Web Streams with runtime-specific socket APIs only at the top layer.
- Support for binary encoding of data types for better complex data type support, network efficiency, and lower memory usage
- TypeScript support out-of-the-box.

## What is PrimalJS?

PrimalJS is a collection of runtime agnostic, standards-first packages for building JavaScript and TypeScript backends. PrimalJS packages leverage modern JavaScript features and tooling to ship with minimal dependencies. Learn more at [primaljs.dev](https://primaljs.dev).

## Getting Started

Install the PrimalJS Postgres Driver with your preferred package manager:

```bash
npm install @primaljs/postgres
```

```bash
pnpm add @primaljs/postgres
```

```bash
yarn add @primaljs/postgres
```

Import the PrimalJS Postgres Driver into your backend and create a client:

```typescript
import { PrimalPostgres, defaultBinaryTypeParser } from "@primaljs/postgres";
import { NodeSocket } from "@primaljs/postgres/node";

const client = new PrimalPostgres({
  connection: "postgresql://user:password@localhost:5432/driver",
  socket: async (hostname, port) => {
    const socket = new NodeSocket(hostname, port);
    await socket.connected;
    return socket;
  },
  types: defaultBinaryTypeParser,
});
```

## Architecture

The architecture is split into layers with different levels of interaction with the platform. This maximizes reuse across runtimes while also simplifying the code.

TODO
