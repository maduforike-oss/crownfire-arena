# Crowdfire Online Rumble and Social Core

## Delivered Vertical Slice

- Four human Rumble seats with bot fill for every open seat
- Guest profiles backed by 90-day bearer sessions
- Six-character private rooms and shareable `?join=ROOM` links
- Ready state, champion loadouts, spectators, presence and two-minute seat retention
- Automatic client retry for sixty seconds using a room-scoped reconnect token
- Server-owned room phase, roster, match identity, rematch voting and result persistence
- PostgreSQL profiles, sessions, friendships, matches and participant telemetry
- Rivalry Chronicle with recent matches, friend invitations, presence and head-to-head summaries
- One-tap Join Rumble for friends who are currently in a room
- Mode-specific Rumble rune budget: ten seeded runes, 40% weighted drops and a sixteen-pickup cap

## Authority Boundary

The service is authoritative for authentication, seats, room lifecycle, ready state,
match IDs, roster validation, persistence and rematches. The current Phaser host
remains authoritative for the live movement/bomb simulation and distributes snapshots
to the other clients. This preserves the existing responsive combat code and enables
the social milestone without rewriting the whole game.

Ranked play must not trust this client-host simulation. Before MMR or purchases are
introduced, move the deterministic grid, movement, bomb, explosion and pickup rules
into a Node-compatible shared simulation and run that simulation on the service.

## Local Development

Run PostgreSQL and the service:

```bash
docker compose up --build
```

In another terminal:

```bash
copy .env.example .env
npm run dev
```

The client uses `VITE_CROWDFIRE_SERVICE_URL`. Without it, localhost defaults to
`http://127.0.0.1:8787`; production builds deliberately show an unavailable-service
message instead of silently sending identity data to an unknown server.

## Deployment

`render.yaml` defines the WebSocket/REST service and PostgreSQL database. After the
Render blueprint is created:

1. Set the GitHub repository variable `CROWDFIRE_SERVICE_URL` to the Render HTTPS URL.
2. Run the GitHub Pages deployment workflow.
3. Confirm `/health` reports `persistence: postgresql`.
4. Test a private room from two different networks before advertising public play.

Apple, Google and email account linking require provider client IDs, redirect URLs and
an email delivery service. They are intentionally not simulated with insecure browser
claims. Guest identities and social records are production-shaped so linked identities
can attach to the same profile later.

## Next Hardening Milestone

1. Extract a deterministic headless match simulation shared by Phaser and Node.
2. Add server input validation, fixed ticks and compact state deltas.
3. Store signed replay/event logs and verify reported placements.
4. Add provider account linking and account recovery.
5. Add moderation, block/report controls and rate limiting.
6. Only then add friends leaderboards, MMR, seasons, tournaments and paid cosmetics.
