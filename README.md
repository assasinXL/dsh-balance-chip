# dsh-balance-chip

A compact **account-balance chip** for the DeepSeek Harness (DSH) Web GUI composer — shown left of the dictation / voice buttons, reusing the bottom info bar's balance snapshot.

## What it does

- Mounts a small pill in the composer's right slot (`conversation.input.right`), so it sits just to the left of the microphone / voice-input button.
- Reads the balance snapshot and current-session usage from the bottom info bar plugin `dsh-bottom-info-bar` over its RPC routes:
  - `_dsh/dsh-bottom-info-bar/getBalanceSnapshot`
  - `_dsh/dsh-bottom-info-bar/getUsageSummary`
- Shows the balance (or credits, depending on the returned `unit`/`currency`) and, on hover, a tooltip with model/provider, balance, input/output tokens, and cache hit rate.
- Supports JS-proxy / relay lines (e.g. `hctopup-*`) that don't expose a balance source: those are rendered as **未适配** instead of an error.

## How it works

The whole feature lives in the browser half (`lib/client.js`). The host half (`lib/index.js`) does nothing — no host routes, no state, no tools. The chip:

1. Resolves the current session's selected provider/model from the model directory.
2. Polls the bottom info bar RPC every 60s and on selection change.
3. Renders a pill + hover tooltip; no network calls except to the local DSH RPC.

## Requirements

- DSH `>=0.2.0-rc.2` (declared in `package.json`).
- The `dsh-bottom-info-bar` plugin must be loaded (this plugin only reads its snapshot; it does not compute balances itself).

## Install (DSH plugin / bundle)

The bundle mount is declared in `cordis.patch.yml`:

```yaml
- insert:
    - id: balance-chip
      name: 'dsh-balance-chip'
```

Drop the package into a DSH profile's `node_modules` (or reference it via your plugin manager / bundle source) and reload the Web GUI.

## Files

| File | Purpose |
|------|---------|
| `package.json` | Package metadata + DSH bundle/client declaration |
| `cordis.patch.yml` | Bundle insert entry |
| `lib/client.js` | Browser half: composer chip + tooltip + RPC polling |
| `lib/index.js` | Host half: no-op |

## Notes

- No secrets, no external network calls. The plugin only talks to the DSH Web GUI's own RPC on the same origin.
- Styling uses CSS variables with fallbacks, so it follows the active theme.
