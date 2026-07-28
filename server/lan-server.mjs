import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? 4173);
const root = join(process.cwd(), 'dist');
const rooms = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0]);
  const safePath = normalize(path).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, safePath === '/' ? 'index.html' : safePath);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600'
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Crownfire asset not found');
  }
});

const wss = new WebSocketServer({ server, path: '/crownfire-lan' });

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';
  do {
    value = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(value));
  return value;
}

function send(socket, value) {
  if (socket?.readyState === 1) socket.send(JSON.stringify(value));
}

function peerCount(room) {
  return [...room.players.values()].filter((player) => player.socket?.readyState === 1).length;
}

function broadcastPeers(room) {
  const message = { type: 'peers', connected: peerCount(room) };
  for (const player of room.players.values()) send(player.socket, message);
}

function attach(socket, player, room) {
  if (player.expiry) clearTimeout(player.expiry);
  player.expiry = undefined;
  player.socket = socket;
  socket.player = player;
  socket.room = room;
  send(socket, {
    type: 'room',
    room: room.code,
    role: player.role,
    clientId: player.id,
    token: player.token
  });
  broadcastPeers(room);
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });
  socket.on('message', (buffer) => {
    let message;
    try {
      message = JSON.parse(buffer.toString());
    } catch {
      return;
    }
    if (message.type === 'hello') {
      if (message.token) {
        for (const room of rooms.values()) {
          const player = [...room.players.values()].find((candidate) => candidate.token === message.token);
          if (player) {
            attach(socket, player, room);
            return;
          }
        }
      }
      if (message.role === 'host') {
        const room = { code: makeCode(), players: new Map() };
        const player = { id: 'host', role: 'host', token: randomUUID(), socket };
        room.players.set(player.id, player);
        rooms.set(room.code, room);
        attach(socket, player, room);
        return;
      }
      const room = rooms.get(String(message.room ?? '').toUpperCase());
      if (!room) {
        send(socket, { type: 'error', message: 'That LAN room no longer exists.' });
        return;
      }
      if (room.players.has('guest') && room.players.get('guest').socket?.readyState === 1) {
        send(socket, { type: 'error', message: 'That LAN room already has two champions.' });
        return;
      }
      const player = room.players.get('guest') ?? {
        id: 'guest',
        role: 'guest',
        token: randomUUID()
      };
      room.players.set('guest', player);
      attach(socket, player, room);
      return;
    }
    const room = socket.room;
    if (!room || !socket.player) return;
    if (message.type === 'relay') {
      for (const player of room.players.values()) {
        if (player !== socket.player) send(player.socket, { type: 'relay', payload: message.payload });
      }
    } else if (message.type === 'start' && socket.player.role === 'host') {
      for (const player of room.players.values()) send(player.socket, { type: 'start', config: message.config });
    }
  });

  socket.on('close', () => {
    const player = socket.player;
    const room = socket.room;
    if (!player || !room || player.socket !== socket) return;
    player.socket = undefined;
    broadcastPeers(room);
    player.expiry = setTimeout(() => {
      room.players.delete(player.id);
      if (player.role === 'host' || room.players.size === 0) rooms.delete(room.code);
      else broadcastPeers(room);
    }, 20000);
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 10000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(port, '0.0.0.0', () => {
  const addresses = [];
  for (const group of Object.values(networkInterfaces())) {
    for (const entry of group ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(`http://${entry.address}:${port}`);
    }
  }
  console.log('\nCrownfire LAN Arena is ready.');
  console.log(`This PC: http://127.0.0.1:${port}`);
  for (const address of addresses) console.log(`iPad / phone: ${address}`);
  console.log('Keep this window open while the LAN match is running.\n');
});
