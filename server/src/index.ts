import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createStore, newSessionToken, type Store } from './store.js';
import { RoomManager, type ConnectedClient } from './rooms.js';
import type { ClientSocketMessage, PublicProfile } from './types.js';

const port = Number(process.env.PORT ?? 8787);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://127.0.0.1:5173';
const configuredOrigins = new Set(
  (process.env.CORS_ORIGINS ?? `${clientOrigin},https://maduforike-oss.github.io`)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const store = createStore();
await store.initialize();
const rooms = new RoomManager(store, clientOrigin);
const profileConnections = new Map<string, number>();

const server = createServer(async (request, response) => {
  try {
    setCors(request, response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/health') {
      return json(response, 200, {
        ok: true,
        service: 'crowdfire-social',
        persistence: process.env.DATABASE_URL ? 'postgresql' : 'memory'
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/auth/guest') {
      const body = await readJson(request);
      const profile = await store.createGuest(
        stringValue(body.displayName),
        numberValue(body.importedCrowns)
      );
      const sessionToken = newSessionToken();
      await store.createSession(profile.id, sessionToken, new Date(Date.now() + 1000 * 60 * 60 * 24 * 90));
      return json(response, 201, { profile, sessionToken });
    }

    const profile = await authenticate(request, store);
    if (!profile) return json(response, 401, { error: 'AUTH_REQUIRED', message: 'A valid Crowdfire session is required.' });

    if (request.method === 'GET' && url.pathname === '/api/v1/me') {
      return json(response, 200, { profile: await store.getProfile(profile.id) });
    }
    if (request.method === 'PATCH' && url.pathname === '/api/v1/me') {
      const body = await readJson(request);
      return json(response, 200, {
        profile: await store.updateProfile(profile.id, stringValue(body.displayName))
      });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/profiles/')) {
      const target = decodeURIComponent(url.pathname.slice('/api/v1/profiles/'.length));
      const found = await store.findProfile(target);
      return found
        ? json(response, 200, { profile: found })
        : json(response, 404, { error: 'PROFILE_NOT_FOUND' });
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/history') {
      return json(response, 200, { matches: await store.history(profile.id, clampLimit(url.searchParams.get('limit'))) });
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/rivalries') {
      return json(response, 200, { rivalries: await store.rivalries(profile.id) });
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/friends') {
      return json(response, 200, { friends: await store.friends(profile.id) });
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/friends/invite') {
      const body = await readJson(request);
      const target = await store.findProfile(stringValue(body.profile));
      if (!target) return json(response, 404, { error: 'PROFILE_NOT_FOUND' });
      await store.requestFriend(profile.id, target.id);
      return json(response, 202, { ok: true, friend: target });
    }
    const acceptMatch = url.pathname.match(/^\/api\/v1\/friends\/([^/]+)\/accept$/);
    if (request.method === 'POST' && acceptMatch) {
      await store.acceptFriend(profile.id, decodeURIComponent(acceptMatch[1]));
      return json(response, 200, { ok: true });
    }
    return json(response, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error(error);
    return json(response, 500, {
      error: 'SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected server error.'
    });
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket) => {
  let client: ConnectedClient | undefined;
  socket.on('message', async (buffer) => {
    let message: ClientSocketMessage;
    try {
      message = JSON.parse(buffer.toString()) as ClientSocketMessage;
    } catch {
      sendSocket(socket, { type: 'error', code: 'BAD_JSON', message: 'Message was not valid JSON.' });
      return;
    }
    try {
      if (message.type === 'hello') {
        const profile = await store.profileForSession(message.sessionToken);
        if (!profile) {
          sendSocket(socket, { type: 'error', code: 'AUTH_REQUIRED', message: 'Your Crowdfire session expired.' });
          socket.close(4001, 'auth required');
          return;
        }
        client = { profile, socket };
        markConnected(profile.id, true);
        if (!rooms.reconnect(client, message.reconnectToken)) rooms.welcome(client);
        return;
      }
      if (!client) {
        sendSocket(socket, { type: 'error', code: 'HELLO_REQUIRED', message: 'Authenticate before joining a room.' });
        return;
      }
      await rooms.handle(client, message);
    } catch (error) {
      console.error(error);
      sendSocket(socket, {
        type: 'error',
        code: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'The room service could not complete that action.'
      });
    }
  });
  socket.on('close', () => {
    if (!client) return;
    rooms.disconnect(client);
    markConnected(client.profile.id, false);
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if ((socket as WebSocket & { isAlive?: boolean }).isAlive === false) {
      socket.terminate();
      continue;
    }
    (socket as WebSocket & { isAlive?: boolean }).isAlive = false;
    socket.ping();
  }
}, 20_000);
wss.on('connection', (socket) => {
  (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
  socket.on('pong', () => {
    (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
  });
});

function markConnected(profileId: string, connected: boolean): void {
  const next = Math.max(0, (profileConnections.get(profileId) ?? 0) + (connected ? 1 : -1));
  profileConnections.set(profileId, next);
  store.setOnline(profileId, next > 0);
}

function setCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin && (configuredOrigins.has(origin) || configuredOrigins.has('*'))) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-headers', 'authorization, content-type');
  response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  response.setHeader('cache-control', 'no-store');
}

async function authenticate(request: IncomingMessage, source: Store): Promise<PublicProfile | undefined> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  return token ? source.profileForSession(token) : undefined;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 32_768) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function sendSocket(socket: WebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampLimit(value: string | null): number {
  const parsed = Number(value ?? 20);
  return Math.max(1, Math.min(50, Number.isFinite(parsed) ? Math.floor(parsed) : 20));
}

const shutdown = async (): Promise<void> => {
  clearInterval(heartbeat);
  for (const socket of wss.clients) socket.close(1012, 'service restart');
  wss.close();
  server.close();
  await store.close();
};
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());

server.listen(port, '0.0.0.0', () => {
  console.log(`Crowdfire social service listening on http://0.0.0.0:${port}`);
  console.log(process.env.DATABASE_URL ? 'PostgreSQL persistence enabled.' : 'Memory persistence enabled for local development.');
});
