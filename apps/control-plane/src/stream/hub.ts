import type { GenericEnvelope } from "@dex-ai/shared";
import type { WSContext } from "hono/ws";

export type Hub = ReturnType<typeof createHub>;

export function createHub() {
  const sockets = new Set<WSContext>();

  function add(socket: WSContext): void {
    sockets.add(socket);
  }

  function remove(socket: WSContext): void {
    sockets.delete(socket);
  }

  function publish(envelope: GenericEnvelope): void {
    const message = JSON.stringify(envelope);
    for (const socket of sockets) {
      socket.send(message);
    }
  }

  function close(): void {
    for (const socket of sockets) {
      socket.close(1001, "server shutting down");
    }
    sockets.clear();
  }

  return { add, remove, publish, close, size: () => sockets.size };
}
