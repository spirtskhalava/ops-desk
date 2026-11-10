# ops-desk

Help desk for an internal ops team. Tickets come in from a web form or from WhatsApp, get a category / priority / SLA deadline automatically and show up on a kanban board.

React + TypeScript (Vite), Firebase: auth, firestore, cloud functions (node 20), hosting. WhatsApp Cloud API for messages, Claude for triage.

## what's in it

- **WhatsApp**: first message from a number opens a ticket, next messages go to the same ticket until it's resolved. Agents reply from the side panel and it goes back to WhatsApp.
- **triage**: firestore trigger on new tickets, asks Claude for category + priority, falls back to simple keyword rules if there's no key or the call fails. If the requester picked a higher priority than the model, theirs wins.
- **SLA**: deadlines count only working hours (mon-fri 9-19, Tbilisi), urgent is 24/7. A scheduled function flags breached tickets every 5 min, the board shows a countdown.
- **roles**: requester / agent / lead in custom claims. Firestore rules check them, requesters only see their own tickets and nobody can touch SLA fields from the client.
- internal notes on tickets

Places that took the most time: `functions/src/sla.ts` (working hours math, friday evening etc), WhatsApp sending the same message twice (`handleInbound` writes the message id with `create()` first and skips duplicates), and signature check on the raw body in `whatsapp.ts`.

## run locally

```
cd functions && npm install && npm run build
cd ../web && npm install && cp .env.example .env
firebase emulators:start      # from repo root
cd web && npm run dev
```

With `VITE_USE_EMULATORS=true` it all runs on the emulators, no real firebase project needed. New users are `requester`, to see the agent view set `{"role": "lead"}` as custom claim in the auth emulator UI.

No `ANTHROPIC_API_KEY` = keyword rules only. For WhatsApp you need a Meta app, locally you can just POST a sample webhook payload (with the signature header).

secrets / params:

```
ANTHROPIC_API_KEY        secret   triage
WHATSAPP_TOKEN           secret   sending replies
WHATSAPP_APP_SECRET      secret   webhook signature
WHATSAPP_VERIFY_TOKEN    param    webhook handshake
WHATSAPP_PHONE_NUMBER_ID param    sender number
```

## tests

`npm test` in `functions` (sla, triage rules, webhook parsing/signature) and in `web` (sla badge).

## todo

- attachments, whatsapp images are ignored for now
- avg first response time per category
- auto close tickets waiting on customer > 5 days
