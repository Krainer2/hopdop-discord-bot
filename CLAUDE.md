# Noter til Claude

- Ejer: Krainer2. Skriver dansk og vil have korte, nemme step-by-step forklaringer.
- Server: Hopdop, Minecraft 1.8.9 HCF/KitPvP. Discord-rollerne har samme navne som LuckPerms-grupperne.
- Ejeren kører på Windows (PowerShell) i mappen Skrivebord\Hopdop-Bot.
- Brug æ/ø/å i al tekst, som brugerne ser.
- `.env` (token) må aldrig committes eller vises. `config.json` og `forslag.json` er lokale filer og ligger i .gitignore.
- `setup.js` køres kun én gang. Nye funktioner hører hjemme i `index.js`.
- Flere Discord-servere: `index.js` reagerer kun på HopDop (GUILD_ID), fordi `client.on` er pakket ind øverst. Alt til de andre servere (Prison, KitPvP, UHC) hører hjemme i `netvaerk.js` (data i `servere.json`). Minecraft-link på de nye servere er ikke lavet endnu (Minecraft-serverne findes ikke endnu).
