# PostgreSQL Protocol Messages

This directory contains individual message class definitions for the PostgreSQL wire protocol.

## Structure

Each message type is defined in its own file, making the codebase more maintainable and easier to navigate.

## Message Types

### Authentication Messages

- `AuthenticationOK.ts` - Authentication successful
- `AuthenticationSASL.ts` - SASL authentication request
- `AuthenticationSASLContinue.ts` - SASL authentication continuation
- `AuthenticationSASLFinal.ts` - SASL authentication final response
- `SASLInitialResponse.ts` - Initial SASL response from client
- `SASLResponse.ts` - SASL response from client
- `authenticationSwitch.ts` - Utility to determine authentication response type

### Connection Messages

- `StartupMessage.ts` - Initial connection startup message
- `BackendKeyData.ts` - Backend process ID and secret key
- `ParameterStatus.ts` - Server parameter status
- `Terminate.ts` - Connection termination

### Query Messages (Simple Query Protocol)

- `Query.ts` - Simple query message
- `CommandComplete.ts` - Command execution completion
- `DataRow.ts` - Data row from query result
- `RowDescription.ts` - Description of result columns
- `ReadyForQuery.ts` - Backend ready for new query

### Extended Query Protocol Messages

- `Parse.ts` - Parse a prepared statement
- `ParseComplete.ts` - Parse completion confirmation
- `Bind.ts` - Bind parameters to prepared statement
- `BindComplete.ts` - Bind completion confirmation
- `Describe.ts` - Describe a prepared statement or portal
- `Execute.ts` - Execute a portal
- `Sync.ts` - Synchronization point
- `Flush.ts` - Flush output
- `ParameterDescription.ts` - Description of statement parameters
- `NoData.ts` - No data available

### Replication Messages

- `CopyBothResponse.ts` - Start of COPY BOTH mode (used for replication)
- `CopyData.ts` - COPY data stream

### Error Handling

- `ErrorResponse.ts` - Error response from server

## Exports

- `index.ts` - Barrel export for all message types

## Usage

All messages are re-exported from `src/protocol.ts` for backward compatibility:

```typescript
import { Query, DataRow, RowDescription } from "./protocol";
```

Or you can import directly from the messages directory:

```typescript
import { Query } from "./messages/Query";
import { DataRow } from "./messages/DataRow";
```

## Message Direction

- **(F)** - Frontend (client) to backend (server)
- **(B)** - Backend (server) to frontend (client)
- **(F & B)** - Can be sent in both directions

## References

See the [PostgreSQL Protocol Documentation](https://www.postgresql.org/docs/current/protocol-message-formats.html) for detailed information about each message type.
