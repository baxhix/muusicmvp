import type { Server, Socket } from 'socket.io';

/** Per-socket data attached during auth handshake. */
export interface SocketData {
  userId: string;
  userName: string | null;
}

// Mirrors Socket.IO's internal `DefaultEventsMap`, kept local because
// socket.io's package exports map doesn't expose `./dist/typed-events`.
// Handlers validate payloads with Zod at runtime, so the loose `any[]` is
// scoped to the realtime layer only.

type AnyEventsMap = { [event: string]: (...args: any[]) => void };

export type AppServer = Server<AnyEventsMap, AnyEventsMap, AnyEventsMap, SocketData>;
export type AppSocket = Socket<AnyEventsMap, AnyEventsMap, AnyEventsMap, SocketData>;
