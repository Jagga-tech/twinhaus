import { WebSocketServer } from 'ws';
import { CompanionCore, parseInbound } from './core.js';

/**
 * Reference Matter companion service. Runs a WebSocket server that speaks the contract the
 * browser's MatterProvider expects, backed by the simulated fabric in {@link CompanionCore}. Point
 * Twinhaus at ws://localhost:5580 (Settings, Device backend, Matter) to drive it.
 *
 * For real hardware, swap the simulated fabric in core.ts for a bridge to python-matter-server; the
 * wire messages here do not change.
 */
const port = Number(process.env.PORT ?? 5580);
const core = new CompanionCore();
const server = new WebSocketServer({ port });

server.on('connection', (socket) => {
  socket.on('message', (data: { toString(): string }) => {
    const message = parseInbound(data.toString());
    if (!message) return;
    for (const out of core.handle(message)) socket.send(JSON.stringify(out));
  });
});

// eslint-disable-next-line no-console
console.log(`Twinhaus Matter companion listening on ws://localhost:${port}`);
