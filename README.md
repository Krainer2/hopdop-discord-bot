# HOPDOP Discord-bot

Discord-bot til Hopdop (Minecraft 1.8.9 HCF/KitPvP). Lavet i Node.js med discord.js v14.

## Funktioner
- **Tickets** med knapper (Support, Køb/Ranks, Ansøgning, Anmeld spiller), luk-knap og log i #ticket-log
- **Verificering**: nye medlemmer trykker på knappen i #regler og får rollen Spiller
- **/forslag**: formular med ingame navn og forslag, ✅/❌-reaktioner og et sID. Staff svarer med `/godkend` og `/afvis`
- **/giveaway**, **/ip**, **/say** og velkomstbesked

## Opsætning
1. Installér [Node.js](https://nodejs.org) (version 18 eller nyere).
2. Kør i mappen: `npm install`
3. Kopiér `.env.example` til `.env` og udfyld `TOKEN`, `CLIENT_ID`, `GUILD_ID` og evt. `SERVER_IP`.
4. Kør **kun én gang**: `node setup.js`
   Det opretter roller, kategorier, kanaler, regler og ticket-panel og gemmer `config.json`.
5. Start botten: `node index.js` (terminalen skal stå åben)

## Filer
| Fil | Hvad |
|---|---|
| `setup.js` | Opretter serverstrukturen. Kør kun én gang |
| `index.js` | Selve botten |
| `config.json` | Rolle- og kanal-ID'er. Laves af setup.js (uploades ikke) |
| `forslag.json` | Gemte forslag. Laves af botten (uploades ikke) |
| `.env` | Token og ID'er. **Må aldrig uploades eller deles** |

## Vigtigt
- Botrollen skal ligge øverst i *Serverindstillinger → Roller*.
- Giveaways huskes kun, mens botten kører.
- Fjern Administrator-rettigheden fra botten, når alt er oprettet.
