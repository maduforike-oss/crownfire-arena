import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const base = process.env.CROWDFIRE_TEST_URL ?? 'http://127.0.0.1:8787';
const wsBase = base.replace(/^http/, 'ws');

async function guest(displayName) {
  const response = await fetch(`${base}/api/v1/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName })
  });
  assert.equal(response.status, 201);
  return response.json();
}

function connect(sessionToken, reconnectToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase}/ws`);
    const events = [];
    const waiters = [];
    socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', sessionToken, reconnectToken })));
    socket.on('message', (buffer) => {
      const message = JSON.parse(buffer.toString());
      events.push(message);
      for (const waiter of [...waiters]) {
        if (!waiter.predicate(message)) continue;
        waiters.splice(waiters.indexOf(waiter), 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      }
    });
    socket.on('error', reject);
    const client = {
      socket,
      events,
      send(value) {
        socket.send(JSON.stringify(value));
      },
      waitFor(predicate, timeoutMs = 3000) {
        const existing = events.find(predicate);
        if (existing) return Promise.resolve(existing);
        return new Promise((waitResolve, waitReject) => {
          const waiter = {
            predicate,
            resolve: waitResolve,
            timer: setTimeout(() => {
              const index = waiters.indexOf(waiter);
              if (index >= 0) waiters.splice(index, 1);
              waitReject(new Error('Timed out waiting for WebSocket event.'));
            }, timeoutMs)
          };
          waiters.push(waiter);
        });
      }
    };
    client.waitFor((message) => message.type === 'welcome').then(() => resolve(client), reject);
  });
}

const identities = await Promise.all(['Ember Host', 'Moon Rival', 'Frost Rival', 'Veil Rival', 'Raven Witness'].map(guest));
const initialClients = await Promise.all(identities.map((identity) => connect(identity.sessionToken)));
const [host, player2, player3, player4, spectator] = initialClients;

host.send({ type: 'create-room', character: 'dragon' });
const created = await host.waitFor((message) => message.type === 'room' && message.room.code);
const roomCode = created.room.code;
assert.equal(roomCode.length, 6);

player2.send({ type: 'join-room', room: roomCode, character: 'wolf' });
player3.send({ type: 'join-room', room: roomCode, character: 'frost' });
player4.send({ type: 'join-room', room: roomCode, character: 'veil' });
await host.waitFor((message) => message.type === 'room' && message.room.seats.filter((seat) => seat.profileId).length === 4);
spectator.send({ type: 'join-room', room: roomCode, character: 'raven', spectator: true });
await spectator.waitFor((message) => message.type === 'room' && message.spectator && message.room.spectators === 1);

const player4Reconnect = await player4.waitFor((message) => message.type === 'welcome' && message.reconnectToken);
player4.socket.close();
await host.waitFor((message) =>
  message.type === 'room'
  && message.room.seats.some((seat) => seat.profileId === identities[3].profile.id && !seat.connected)
);
const reconnectedPlayer4 = await connect(identities[3].sessionToken, player4Reconnect.reconnectToken);
await reconnectedPlayer4.waitFor((message) =>
  message.type === 'room'
  && message.room.seats.some((seat) => seat.profileId === identities[3].profile.id && seat.connected)
);
const clients = [host, player2, player3, reconnectedPlayer4];

for (const client of clients) client.send({ type: 'ready', ready: true });
await host.waitFor((message) => message.type === 'room' && message.room.seats.every((seat) => seat.ready));
host.send({ type: 'start', map: 'moonfang' });
const starts = await Promise.all(clients.map((client) => client.waitFor((message) => message.type === 'start')));
await spectator.waitFor((message) => message.type === 'start');
const config = starts[0].config;
assert.equal(config.players.length, 4);
assert.equal(config.mode, 'grand');
assert.equal(config.map, 'moonfang');

player2.send({ type: 'relay', payload: { kind: 'input', input: { direction: 'right', sequence: 1 } } });
const relay = await host.waitFor((message) => message.type === 'relay' && message.fromProfileId === identities[1].profile.id);
assert.equal(relay.payload.kind, 'input');

const matchId = config.matchId;
const endedAt = new Date().toISOString();
host.send({
  type: 'match-result',
  result: {
    id: matchId,
    roomCode,
    map: 'moonfang',
    mode: 'grand',
    reason: 'Smoke test Rumble complete.',
    winnerProfileId: identities[0].profile.id,
    startedAt: new Date(Date.now() - 10_000).toISOString(),
    endedAt,
    participants: identities.slice(0, 4).map((identity, seat) => ({
      profileId: identity.profile.id,
      seat,
      displayName: identity.profile.displayName,
      character: ['dragon', 'wolf', 'frost', 'veil'][seat],
      placement: seat + 1,
      kills: seat === 0 ? 3 : 0,
      deaths: seat === 0 ? 0 : 1,
      bombsPlaced: 4 + seat,
      runesCollected: 2,
      shards: 0,
      survivalMs: 10_000 - seat * 1000,
      won: seat === 0
    }))
  }
});
await host.waitFor((message) => message.type === 'match-recorded' && message.matchId === matchId);

const authHeaders = { authorization: `Bearer ${identities[0].sessionToken}` };
const historyResponse = await fetch(`${base}/api/v1/history`, { headers: authHeaders });
assert.equal(historyResponse.status, 200);
const history = await historyResponse.json();
assert.equal(history.matches[0].id, matchId);

const inviteResponse = await fetch(`${base}/api/v1/friends/invite`, {
  method: 'POST',
  headers: { ...authHeaders, 'content-type': 'application/json' },
  body: JSON.stringify({ profile: identities[1].profile.handle })
});
assert.equal(inviteResponse.status, 202);
const acceptResponse = await fetch(`${base}/api/v1/friends/${identities[0].profile.id}/accept`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${identities[1].sessionToken}`,
    'content-type': 'application/json'
  }
});
assert.equal(acceptResponse.status, 200);

const rivalriesResponse = await fetch(`${base}/api/v1/rivalries`, { headers: authHeaders });
const rivalries = await rivalriesResponse.json();
assert.ok(rivalries.rivalries.some((entry) => entry.profile.id === identities[1].profile.id));

for (const client of clients) client.send({ type: 'rematch-vote' });
const rematch = await host.waitFor((message) => message.type === 'start' && message.config.matchId !== matchId);
assert.notEqual(rematch.config.matchId, matchId);

for (const client of clients) client.socket.close();
spectator.socket.close();
console.log(`Crowdfire social smoke test passed: room ${roomCode}, match ${matchId}, four seats, spectator, reconnect, history, rivalry, friends, rematch.`);
