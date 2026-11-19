// (c) 2026 Krainer2 - Alle rettigheder forbeholdt
// NETVÆRK: HOPDOP Bot på de andre HopDop-servere (Prison, KitPvP ...).
// Gederne Butik Bot: en HELT separat bot (eget navn/token: SHOP_TOKEN i .env), der kører fra samme proces.
// Den nævner aldrig HopDop, så butikken ikke kan spores tilbage.
// HopDop selv (GUILD_ID) styres stadig KUN af index.js. Denne fil rører aldrig HopDop-serveren.
// Data for hver server gemmes i servere.json (lokal fil, uploades ikke til GitHub).
const fs = require('fs');
const { ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, MessageFlags, AttachmentBuilder, PermissionsBitField, ChannelFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const FIL = 'servere.json';
const hent = () => { try { return JSON.parse(fs.readFileSync(FIL, 'utf8')); } catch { return {}; } };
const data = hent();
const gem = () => fs.writeFileSync(FIL, JSON.stringify(data, null, 2));
// Lille logfil (Wispbyte-konsollen kan ikke altid læses): netvaerk-log.txt
const spor = t => { try { fs.appendFileSync('netvaerk-log.txt', `${new Date().toISOString()} ${t}\n`); } catch { /* ingen log */ } };

// ---------- SKABELONER ----------
const TYPER = {
  prison: { navn: 'Prison', farve: 0xf97316, emoji: '🔒' },
  kitpvp: { navn: 'KitPvP', farve: 0xef4444, emoji: '⚔️' },
  uhc: { navn: 'UHC', farve: 0xeab308, emoji: '🍎' },
  shop: { navn: 'Shop', farve: 0x10b981, emoji: '🛒' },
  andet: { navn: 'Server', farve: 0x22c55e, emoji: '🎮' },
};
const STAFF_ROLLER = ['Ejer', 'Admin', 'Mod', 'Hjælper'];
const ROLLER = {
  faelles: [
    { navn: 'Ejer', farve: 0xdc2626, hoist: true },
    { navn: 'Admin', farve: 0xef4444, hoist: true },
    { navn: 'Mod', farve: 0x3b82f6, hoist: true },
    { navn: 'Hjælper', farve: 0x22c55e, hoist: true },
    { navn: 'Spiller', farve: 0x94a3b8, hoist: false },
  ],
  prison: [{ navn: 'Vagt', farve: 0x1d4ed8, hoist: true }],
  kitpvp: [{ navn: 'Event', farve: 0xa855f7, hoist: false }],
  uhc: [{ navn: 'Host', farve: 0xeab308, hoist: true }],
  shop: [{ navn: 'Skripter', farve: 0x06b6d4, hoist: true }, { navn: 'Trusted', farve: 0x10b981, hoist: true }, { navn: 'Booster', farve: 0xf47fff, hoist: true }, { navn: 'Kunde', farve: 0xf59e0b, hoist: true }],
  andet: [],
};
// las = kun læse: kun staff poster/skriver (som på HopDop HCF). reager = medlemmer må reagere. skriv = roller, der må skrive alligevel.
// rolle = kun den rolle (+ staff) kan se kanalen. ikke = springes over for de typer. forum = forum-kanal (galleri). slow = cooldown i sek.
// Tags i shop-forummerne virker som filtre (max 20 pr. forum). Hvert opslag skal have mindst ét.
const TAG_TYPE = [['Skript', '📜'], ['Plugin', '🧩'], ['Setup', '🏗️']];
const TAG_FILTRE = [['Prison', '🔒'], ['KitPvP', '⚔️'], ['HCF', '🏰'], ['Minigames', '🎮'], ['Blandede', '🧺'],
  ['Spiller', '🙋'], ['Staff', '🛡️'], ['Økonomi', '💰'], ['Menuer', '📋'], ['Events', '🎉']];
const KANALER = {
  start: [
    // Kun for nye (ikke-verificerede): skjult for Spiller, ligesom Velkommen-kategorien på HopDop HCF
    { id: 'start', kat: '[ 👋 | START HER ]', kanaler: [
      { n: 'guide', navn: '✅┃sådan-kommer-du-ind', aaben: 'laes', topic: 'Sådan får du adgang til resten af serveren.' },
      { n: 'sighej', navn: '👋┃sig-hej', aaben: 'skriv', slow: 10, topic: 'Sig hej og præsentér dig selv.' },
      { n: 'spoergsmaal', navn: '❓┃spørgsmål', aaben: 'skriv', slow: 10, topic: 'Spørg om alt. Staff hjælper dig.' },
    ] },
    { id: 'info', kat: '[ 📌 | INFORMATION ]', kanaler: [
      { n: 'regler', navn: '📜┃regler', las: true, alle: true, topic: 'Læs reglerne, og tryk på knappen for at få adgang.' },
      { n: 'velkommen', navn: '👋┃velkommen', las: true, topic: 'Nye medlemmer bydes velkommen her.' },
      { n: 'nyheder', navn: '📢┃nyheder', las: true, reager: true, topic: 'Nyheder og annonceringer.' },
      { n: 'devlog', navn: '🛠️┃dev-log', las: true, reager: true, topic: 'Hvad er nyt og ændret?' },
      { n: 'serverip', navn: '🌐┃server-ip', las: true, ikke: ['shop'], topic: 'Serverens IP, og sådan joiner du.' },
    ] },
    { id: 'community', kat: '[ 💬 | COMMUNITY ]', kanaler: [
      { n: 'chat', navn: '💬┃chat', slow: 3, topic: 'Snak om alt muligt. Hold en god tone.' },
      { n: 'botkmd', navn: '🤖┃bot-kommandoer', slow: 5, topic: 'Her bruger du bottens kommandoer, fx /forslag, /anmeld og /invite. De virker kun i denne kanal.' },
      { n: 'hjaelp', navn: '🤝┃hjælp-hinanden', slow: 600, traade: true,
        topic: '🧵 SKRIV I EN TRÅD! Kanalen har 10 min cooldown, tråde har ingen. Tryk # øverst → Opret tråd. Skriver du her, laver botten en tråd til dig.' },
      { n: 'forslag', navn: '💡┃forslag', las: true, reager: true, topic: 'Stem på forslag med reaktioner. Lav et forslag: skriv /forslag i #bot-kommandoer.' },
      { n: 'medier', navn: '🖼️┃medier', slow: 10, kun: ['shop'], topic: 'Billeder og videoer af dine builds, servere og setups.' },
      { n: 'scripting', navn: '💻┃skript-snak', slow: 3, kun: ['shop'], topic: 'Snak om Skript, plugins og udvikling. Hjælp hinanden.' },
      { n: 'minecraft', navn: '⛏️┃minecraft-snak', slow: 3, kun: ['shop'], topic: 'Alt om Minecraft og servere.' },
      { n: 'memes', navn: '😂┃memes', slow: 10, kun: ['shop'], topic: 'Memes og sjove ting. Hold det pænt.' },
      { n: 'kreationer', navn: '🧪┃kreationer', las: true, reager: true, skriv: ['Trusted', 'Skripter'], kun: ['shop'],
        forum: { tags: [['Skript', '📜'], ['Plugin', '🧩'], ['Build', '🏗️'], ['Setup', '⚙️'], ['Værktøj', '🛠️'], ['Idé', '💡'], ['Under udvikling', '🚧'], ['Færdig', '✅']], reaktion: '🔥' },
        topic: 'Her deler Trusted og Skriptere deres egne kreationer: scripts, plugins, builds og setups. Alle kan se og reagere. Vil du dele her? Få rollen Trusted eller Skripter af staff.' },
    ] },
  ],
  prison: [{ id: 'prison', kat: '[ 🔒 | PRISON ]', kanaler: [
    { n: 'vagtinfo', navn: '🚔┃bliv-vagt', las: true, reager: true, topic: 'Sådan bliver du vagt. Ansøg via en ticket.' },
    { n: 'ranks', navn: '🏢┃celler-og-ranks', las: true, reager: true, topic: 'Oversigt over celler og ranks.' },
    { n: 'vagtchat', navn: '👮┃vagt-chat', rolle: 'Vagt', topic: 'Kun for vagter og staff.' },
  ] }],
  kitpvp: [{ id: 'kitpvp', kat: '[ ⚔️ | KITPVP ]', kanaler: [
    { n: 'kits', navn: '🗡️┃kits', las: true, reager: true, topic: 'Alle kits og hvad de indeholder.' },
    { n: 'duels', navn: '🥊┃duels', slow: 5, topic: 'Find en modstander til en 1v1.' },
    { n: 'leaderboard', navn: '🏆┃leaderboard', las: true, reager: true, topic: 'Top-spillerne.' },
    { n: 'clips', navn: '🎬┃clips', slow: 10, topic: 'Del dine bedste clips.' },
  ] }],
  uhc: [{ id: 'uhc', kat: '[ 🍎 | UHC ]', kanaler: [
    { n: 'uhcevents', navn: '📣┃uhc-events', las: true, reager: true },
    { n: 'hosting', navn: '⏰┃hosting-tider', las: true, reager: true },
    { n: 'teamsoeg', navn: '🤝┃team-søgning', slow: 10 },
    { n: 'halloffame', navn: '🏆┃hall-of-fame', las: true, reager: true },
  ] }],
  shop: [{ id: 'shop', kat: '[ 🛒 | SHOP ]', kanaler: [
    { n: 'produkter', navn: '📦┃produkter', las: true, reager: true, alle: true, forum: { tags: [...TAG_TYPE, ...TAG_FILTRE, ['Gratis', '🎁'], ['Udsalg', '🏷️'], ['Nyt', '🆕'], ['Populær', '⭐']], reaktion: '🔥' },
      topic: 'Alle vores produkter. Ét opslag pr. produkt med billeder, pris og beskrivelse. Køb via en ticket i #opret-ticket. Se også shoppen på https://gederneshop.pages.dev' },
    { n: 'showcase', navn: '🎬┃showcase', las: true, reager: true, alle: true, forum: { tags: [['Video', '🎥'], ['Billeder', '🖼️'], ...TAG_FILTRE, ['Custom', '✍️'], ['Opdatering', '🆕']], reaktion: '🔥' },
      topic: 'Se vores scripts i aktion. Videoer og billeder af hvad vi har lavet.' },
    { n: 'priser', navn: '💰┃priser', las: true, reager: true, alle: true, topic: 'Prisoversigt.' },
    { n: 'opdateringer', navn: '🆕┃opdateringer', las: true, reager: true, topic: 'Nye versioner og rettelser af vores produkter.' },
    { n: 'anmeldelser', navn: '⭐┃anmeldelser', las: true, reager: true, alle: true, topic: 'Anmeldelser fra vores kunder. Har du købt noget? Skriv /anmeld.' },
  ] }],
  andet: [],
  slut: [
    { id: 'partner', kat: '[ 🤝 | PARTNERE ]', kanaler: [
      { n: 'partnere', navn: '🤝┃samarbejdspartnere', las: true, reager: true, topic: 'Vores samarbejdspartnere. Vil du være partner? Opret en ticket og vælg Samarbejde.' },
      { n: 'reklame', navn: '📣┃reklame', slow: 21600, traade: true,
        forum: { tags: [['Minecraft', '⛏️'], ['Discord', '💬'], ['Gaming', '🎮'], ['Community', '🤝'], ['Projekt', '🛠️'], ['Andet', '📦']], reaktion: '📣' },
        topic: 'Reklamér for din server eller dit projekt! Ét opslag pr. person: titel = navnet, vælg et tag, vedhæft et banner og husk et Discord-invite. Læs det fastgjorte opslag først.' },
    ] },
    { id: 'boost', kat: '[ 💜 | BOOSTERS ]', kun: ['shop'], kanaler: [
      { n: 'boosts', navn: '🔮┃boosts', las: true, reager: true, topic: 'Se hvad serveren låser op ved næste boost. Tak til alle boosters! 💜' },
      { n: 'boosterlounge', navn: '💜┃booster-lounge', rolle: 'Booster', topic: 'Kun for boosters. Tak fordi du støtter os! 💜' },
      { n: 'boostervoice', navn: '💜┃Booster-snak', voice: true, rolle: 'Booster' },
    ] },
    { id: 'support', kat: '[ 🎫 | SUPPORT ]', kanaler: [{ n: 'ticket', navn: '🎫┃opret-ticket', las: true, topic: 'Tryk på en knap for at oprette en ticket.' },
      { n: 'ticketarkiv', navn: '📁┃ticket-arkiv', las: true, kunTop: true, topic: 'Her gemmes lukkede tickets som private tråde. Du kan kun se dine egne.' }] },
    { id: 'voice', kat: '[ 🔊 | SNAK ]', kanaler: [
      { n: 'voice1', navn: '💬┃Hyggesnak 1', voice: true },
      { n: 'voice2', navn: '💬┃Hyggesnak 2', voice: true },
    ] },
    { id: 'staff', kat: '[ 🛡️ | STAFF ]', staff: true, kanaler: [
      { n: 'staffchat', navn: '🛡️┃staff-chat' },
      { n: 'ticketlog', navn: '📋┃ticket-log', kunTop: true },
      { n: 'botlog', navn: '📋┃bot-log' },
    ] },
  ],
};
const TICKETS = {
  prison: [['support', 'Support', '🛠️'], ['vagt', 'Vagt-ansøgning', '👮'], ['anmeld', 'Anmeld spiller', '🚨'], ['partner', 'Samarbejde', '🤝']],
  kitpvp: [['support', 'Support', '🛠️'], ['ansog', 'Staff-ansøgning', '📝'], ['anmeld', 'Anmeld spiller', '🚨'], ['partner', 'Samarbejde', '🤝']],
  uhc: [['support', 'Support', '🛠️'], ['host', 'Host-ansøgning', '🎙️'], ['anmeld', 'Anmeld spiller', '🚨'], ['partner', 'Samarbejde', '🤝']],
  shop: [['koeb', 'Køb et script', '🛒'], ['bestil', 'Bestil custom script', '✍️'], ['support', 'Support', '🛠️'], ['partner', 'Samarbejde', '🤝']],
  andet: [['support', 'Support', '🛠️'], ['ansog', 'Staff-ansøgning', '📝'], ['anmeld', 'Anmeld spiller', '🚨'], ['partner', 'Samarbejde', '🤝']],
};
const TICKET_TEKST = {
  shop: 'Vil du købe et script, bestille et custom script, eller har du brug for hjælp?\nVælg en knap nedenfor. Så får du din egen kanal, hvor vi kan snakke sammen.',
  standard: 'Brug for hjælp, vil du søge, eller skal du anmelde en spiller?\nVælg en knap nedenfor. Så får du din egen kanal med staff.',
};
// Regler i sektioner: [overskrift, tekst]. Nummereres automatisk på tværs af sektionerne.
const REGEL_SEKTIONER = [
  { emoji: '🤝', titel: 'Opførsel', farve: 0x22c55e, regler: [
    ['Vis respekt', 'Ingen racisme, trusler, hetz eller personangreb. Behandl andre, som du selv vil behandles.'],
    ['Intet upassende indhold', 'Ingen NSFW, gore eller andet ubehageligt indhold. Det gælder også navne og profilbilleder.'],
  ] },
  { emoji: '💬', titel: 'Chat og kanaler', farve: 0x3b82f6, regler: [
    ['Ingen spam', 'Ingen spam, caps-spam, flood eller unødvendige pings.'],
    ['Brug de rigtige kanaler', 'Hver kanal har sit formål. Kommandoer hører til i #bot-kommandoer.'],
    ['Reklame kun i #reklame', 'Reklame for andre servere må kun ligge i #reklame. Reklame i DM er ikke tilladt.'],
  ] },
  { emoji: '🛡️', titel: 'Fair play og staff', farve: 0xf59e0b, regler: [
    ['Ingen snyd', 'Ingen hacks, macros eller udnyttelse af fejl. Finder du en fejl, så lav en ticket.'],
    ['Staff har det sidste ord', 'Følg staffs anvisninger. Er du uenig, så lav en ticket i stedet for at diskutere i chatten.'],
  ] },
];
const REGEL_SEKTIONER_SHOP = [
  { emoji: '🛒', titel: 'Produkter og licens', farve: 0xa855f7, regler: [
    ['Ejerskab', 'Alle scripts, plugins og setups fra Gederne Shop tilhører **krainer2** og **Rajobo**. Når du køber, får du lov til at **bruge** produktet på din egen server. Du ejer det ikke.'],
    ['Ingen deling', 'Du må **ikke dele, videresælge, uploade, leake eller give** produkterne videre, heller ikke gratis, uden skriftlig tilladelse fra krainer2 eller Rajobo.'],
    ['Ingen kopier', 'Du må **ikke** ændre et produkt og udgive det som dit eget, fjerne vores navn/mærkning eller prøve at knække krypteringen.'],
  ] },
  { emoji: '🔒', titel: 'Beskyttelse og straf', farve: 0xef4444, regler: [
    ['Mærket og krypteret', 'Alle produkter er **mærket og krypteret**. Vi kan se, når et produkt bliver delt eller brudt, og hvem det kommer fra.'],
    ['Straf', 'Brud på reglerne om produkter giver **permanent ban** og **tab af alle licenser** uden refundering. Vi kan også gå videre med sagen.'],
  ] },
  { emoji: '📌', titel: 'Ændringer', farve: 0x64748b, regler: [
    ['Vi kan ændre reglerne', 'Vi kan til enhver tid ændre reglerne og vilkårene for et produkt. Det gælder også, selvom du har **boostet** serveren eller **købt** hos os før. Tidligere køb eller boosts giver ikke særlige rettigheder.'],
  ] },
];
const sektionerFor = type => type === 'shop' ? [...REGEL_SEKTIONER, ...REGEL_SEKTIONER_SHOP] : REGEL_SEKTIONER;
// Flad liste (bruges i Discords regel-skærm ved verificering)
const reglerFor = type => sektionerFor(type).flatMap(x => x.regler).map(([t, b], i) => `**${i + 1}.** **${t}:** ${b}`);
function reglerEmbeds(d, navn, f) {
  let nr = 0;
  const top = new EmbedBuilder().setColor(f).setAuthor({ name: navn }).setTitle('📜 Serverens regler')
    .setDescription('Læs reglerne herunder. Når du trykker **✅ Jeg accepterer reglerne**, siger du ja til at følge dem.\nKender du ikke reglerne, er det ikke en undskyldning. 🙂');
  const dele = sektionerFor(d.type).map(sek => new EmbedBuilder().setColor(sek.farve).setTitle(`${sek.emoji} ${sek.titel}`)
    .setDescription(sek.regler.map(([t, b]) => `**\`${++nr}\` ${t}**\n${b}`).join('\n\n')));
  const bund = new EmbedBuilder().setColor(f)
    .setDescription('⚖️ Brud på reglerne kan give **advarsel, mute, kick eller ban**, alt efter hvor groft det er.\n🎫 Har du spørgsmål til reglerne, så lav en ticket.')
    .setFooter({ text: 'Reglerne kan blive opdateret. Tjek dem en gang imellem.' });
  return [top, ...dele, bund];
}

// ---------- HJÆLPERE ----------
const info = g => data[g.id] || null;
const navnPaa = g => info(g)?.navn || g.name;
const farve = g => TYPER[info(g)?.type]?.farve || 0x22c55e;
// Kun Ejer og Admin (og folk med Administrator) må lukke/slette tickets og rydde i ticket-arkivet
const TOP_ROLLER = ['Ejer', 'Admin'];
const erTop = (m, d) => m.permissions.has(P.Administrator) || m.guild.ownerId === m.id || TOP_ROLLER.some(r => d?.roller?.[r] && m.roles.cache.has(d.roller[r]));
const erStaff = (m, d) => m.permissions.has(P.Administrator) || m.guild.ownerId === m.id || STAFF_ROLLER.some(r => d?.roller?.[r] && m.roles.cache.has(d.roller[r]));
const svar = (i, tekst, ekstra = {}) => (i.replied || i.deferred ? i.editReply({ content: tekst, ...ekstra }) : i.reply({ content: tekst, flags: MessageFlags.Ephemeral, ...ekstra })).catch(() => {});

// ---------- ROLLER ----------
// Grund-rettigheder for rollerne (resten styres pr. kanal). Ingen almindelige medlemmer kan pinge @everyone eller roller.
const ROLLE_RET = {
  Booster: [P.ChangeNickname, P.UseExternalEmojis, P.UseExternalStickers, P.AttachFiles, P.EmbedLinks, P.Stream],
  Ejer: [P.Administrator],
  Admin: [P.ManageGuild, P.ManageChannels, P.ManageRoles, P.ViewAuditLog, P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.ManageNicknames, P.MoveMembers, P.MuteMembers, P.DeafenMembers, P.MentionEveryone, P.ManageEvents],
  Mod: [P.ViewAuditLog, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.ManageNicknames, P.MoveMembers, P.MuteMembers, P.MentionEveryone],
  Hjælper: [P.ModerateMembers, P.ManageMessages, P.MoveMembers],
};
const ROLLE_VIS = { shop: { Spiller: 'Geder' } };
const visNavn = (type, navn) => ROLLE_VIS[type]?.[navn] || navn;
async function sikrRolle(g, d, r) {
  const vis = visNavn(d.type, r.navn);
  let rolle = d.roller[r.navn] && await g.roles.fetch(d.roller[r.navn]).catch(() => null);
  if (!rolle) rolle = g.roles.cache.find(x => (x.name === vis || x.name === r.navn) && !x.managed) || await g.roles.create({ name: vis, color: r.farve, hoist: r.hoist, mentionable: false, permissions: [], reason: '/setup' });
  if (rolle.name !== vis) await rolle.setName(vis, 'Rollenavn').catch(() => {});
  d.roller[r.navn] = rolle.id;
  return rolle;
}
// Rettigheder, synlighed i medlemslisten og rækkefølge: Ejer > Admin > Mod > Hjælper > (Vagt/Kunde ...) > Spiller > Bots
async function ordnRoller(g, d, type, rapport) {
  await g.roles.fetch();
  const alle = [...ROLLER.faelles.slice(0, 4), ...ROLLER[type], ROLLER.faelles[4]];
  for (const r of alle) {
    const rolle = g.roles.cache.get(d.roller[r.navn]); if (!rolle || rolle.editable === false) continue;
    const ret = ROLLE_RET[r.navn] || [];
    await rolle.edit({ hoist: r.navn === 'Spiller' ? true : r.hoist, mentionable: false, permissions: ret, reason: 'Rettigheder' }).catch(e => rapport.push(`Rolle ${r.navn}: ${e.message}`));
  }
  // @everyone må ikke pinge alle
  const ev = g.roles.everyone;
  if (ev.permissions.has(P.MentionEveryone)) await ev.setPermissions(ev.permissions.remove(P.MentionEveryone)).catch(() => {});
  // Bots: egen sektion nederst i medlemslisten (bottens egen rolle vises ikke for sig selv)
  const mig = g.members.me;
  const botRolle = mig.roles.botRole;
  if (botRolle?.hoist) await botRolle.edit({ hoist: false }).catch(() => {});
  let bots = d.roller.Bots && g.roles.cache.get(d.roller.Bots);
  if (!bots) bots = g.roles.cache.find(x => x.name === 'Bots' && !x.managed) || await g.roles.create({ name: 'Bots', color: 0x64748b, hoist: true, mentionable: false, permissions: [], reason: 'Bots-rolle' }).catch(e => { rapport.push(`Bots-rolle: ${e.message}`); return null; });
  if (bots) {
    d.roller.Bots = bots.id;
    if (!mig.roles.cache.has(bots.id)) await mig.roles.add(bots).catch(() => {});
    // (andre bots i cachen får også rollen – ingen fuld medlemsliste-hentning, den bliver rate-limited)
    for (const m of g.members.cache.values()) if (m.user.bot && !m.roles.cache.has(bots.id)) await m.roles.add(bots).catch(() => {});
  }
  // Rækkefølge (kun roller under bottens egen rolle kan flyttes)
  const top = mig.roles.highest.position;
  const raekke = [...alle.map(r => g.roles.cache.get(d.roller[r.navn])), bots].filter(Boolean);
  const n = raekke.length;
  if (raekke.every(r => r.position < top) && top - n >= 1) {
    const ok = await g.roles.setPositions(raekke.map((r, i) => ({ role: r.id, position: top - 1 - i }))).then(() => true).catch(() => false);
    if (!ok) {
      // Plan B: flyt én rolle ad gangen, oppefra og ned (hver rolle lige under den forrige)
      for (let i = 1; i < n; i++) {
        await g.roles.fetch();
        const over = g.roles.cache.get(raekke[i - 1].id), rolle = g.roles.cache.get(raekke[i].id);
        if (rolle.position !== over.position - 1) await rolle.setPosition(over.position - (rolle.position > over.position ? 0 : 1)).catch(e => rapport.push(`Rolle ${rolle.name}: ${e.message}`));
      }
      await g.roles.fetch();
      spor(`${g.name} roller: ${[...g.roles.cache.values()].sort((a, b) => b.position - a.position).map(x => `${x.name}@${x.position}`).join(', ')}`);
    }
  } else rapport.push(`(bot@${top}, ${n} roller) ` + 'Rolle-rækkefølge: flyt bottens rolle øverst under Serverindstillinger → Roller, og kør /setup igen.');
}

// ---------- KANAL-RETTIGHEDER (som HopDop HCF) ----------
const LAAS = [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads];
function rettigheder(g, d, k, staffKat) {
  const staff = STAFF_ROLLER.map(r => d.roller[r]).filter(Boolean);
  const spiller = d.roller.Spiller;
  const ow = [{ id: g.roles.everyone.id, deny: [P.ViewChannel] }];
  const staffRet = k.voice ? [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.MoveMembers, P.MuteMembers]
    : [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.ManageThreads, P.ManageMessages];
  const lavere = new Set(STAFF_ROLLER.filter(r => !TOP_ROLLER.includes(r)).map(r => d.roller[r]).filter(Boolean));
  const SLET = [P.ManageMessages, P.ManageThreads, P.ManageChannels];
  const staffOw = s => k.kunTop && lavere.has(s) ? { id: s, allow: staffRet.filter(x => !SLET.includes(x)), deny: SLET } : { id: s, allow: staffRet };
  if (staffKat) { for (const s of staff) ow.push(staffOw(s)); return ow; }
  if (k.aaben) {
    const skriv = k.aaben === 'skriv';
    ow[0] = { id: g.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory, ...(skriv ? [P.SendMessages, P.AddReactions] : [])], deny: [P.CreatePublicThreads, P.CreatePrivateThreads, P.MentionEveryone, ...(skriv ? [] : [P.SendMessages, P.AddReactions])] };
    // verificerede (Spiller, Kunde, Vagt ...) ser dem ikke. Staff kan stadig se dem for at hjælpe nye.
    for (const [navn, id] of Object.entries(d.roller)) if (!STAFF_ROLLER.includes(navn) && navn !== 'Bots' && id) ow.push({ id, deny: [P.ViewChannel] });
    for (const s of staff) ow.push(staffOw(s));
    return ow;
  }
  const laesning = [P.ViewChannel, P.ReadMessageHistory, ...(k.reager ? [P.AddReactions] : [])];
  const laesNej = [...LAAS, ...(k.reager ? [] : [P.AddReactions])];
  if (k.alle) ow[0] = { id: g.roles.everyone.id, allow: laesning, deny: laesNej };
  if (k.rolle) {
    if (d.roller[k.rolle]) ow.push({ id: d.roller[k.rolle], allow: k.voice ? [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD] : [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions] });
  } else if (spiller) {
    if (k.voice) ow.push({ id: spiller, allow: [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD] });
    else if (k.las) ow.push({ id: spiller, allow: laesning, deny: laesNej });
    else if (k.traade) ow.push({ id: spiller, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.CreatePublicThreads, P.SendMessagesInThreads], deny: [P.CreatePrivateThreads] });
    else ow.push({ id: spiller, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions], deny: [P.CreatePublicThreads, P.CreatePrivateThreads] });
  }
  for (const r of k.skriv || []) if (d.roller[r]) ow.push({ id: d.roller[r], allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.SendMessagesInThreads, P.AttachFiles, P.EmbedLinks, P.AddReactions] });
  for (const s of staff) ow.push(staffOw(s));
  return ow;
}

// Er kanalens rettigheder allerede som ønsket? (så sparer vi kald til Discord og undgår rate limits)
function sammeRet(k, ow) {
  const nu = k.permissionOverwrites?.cache; if (!nu || nu.size !== ow.length) return false;
  return ow.every(o => { const x = nu.get(o.id); return x && x.allow.bitfield === PermissionsBitField.resolve(o.allow || []) && x.deny.bitfield === PermissionsBitField.resolve(o.deny || []); });
}
// Finder eller opretter en kanal, og retter navn, emne, cooldown og rettigheder, så de altid passer til skabelonen
async function sikrKanal(g, d, noegle, opts, rapport, ekstra = {}) {
  let k = d.kanaler[noegle] && await g.channels.fetch(d.kanaler[noegle]).catch(() => null);
  // Skal være et forum, men er en almindelig kanal: lav forummet, og fjern den gamle, hvis den er tom
  if (k && opts.type === ChannelType.GuildForum && k.type !== ChannelType.GuildForum) {
    const ny = await g.channels.create({ ...opts, reason: '/setup' }).catch(e => { rapport.push(`Forum ${opts.name} (kræver Community): ${e.message}`); return null; });
    if (!ny) return k;
    const msgs = await k.messages?.fetch({ limit: 10 }).catch(() => null);
    const tom = !msgs || ![...msgs.values()].some(m => m.author.id !== g.client.user.id);
    if (tom) await k.delete('Erstattet af forum med galleri').catch(() => {});
    else await k.setName(`${k.name}-gammel`).catch(() => {});
    await ny.setPosition(tom ? ny.position : k.position).catch(() => {});
    k = ny;
  }
  if (!k) {
    k = await g.channels.create({ ...opts, reason: '/setup' }).catch(e => { rapport.push(`${opts.name}: ${e.message}`); return null; });
    if (!k) return null;
  } else {
    const aendr = {};
    if (k.name !== opts.name) aendr.name = opts.name;
    if (opts.parent && k.parentId !== opts.parent) aendr.parent = opts.parent;
    if (opts.topic !== undefined && 'topic' in k && (k.topic || '') !== (opts.topic || '')) aendr.topic = opts.topic;
    if (opts.rateLimitPerUser !== undefined && 'rateLimitPerUser' in k && (k.rateLimitPerUser || 0) !== (opts.rateLimitPerUser || 0)) aendr.rateLimitPerUser = opts.rateLimitPerUser;
    if (k.type === ChannelType.GuildForum && opts.defaultForumLayout !== undefined && k.defaultForumLayout !== opts.defaultForumLayout) aendr.defaultForumLayout = opts.defaultForumLayout;
    if (k.type === ChannelType.GuildForum && opts.availableTags) {
      // Nye tags tilføjes (gamle beholdes, så opslag ikke mister deres tags)
      // (kun staff kan lave opslag, så tags behøver ikke være "kun moderatorer" - og Discord kræver mindst ét frit tag)
      const mangler = opts.availableTags.filter(t => !k.availableTags.some(x => x.name === t.name));
      if (mangler.length || k.availableTags.some(x => x.moderated))
        aendr.availableTags = [...k.availableTags.map(x => ({ id: x.id, name: x.name, emoji: x.emoji, moderated: false })), ...mangler].slice(0, 20);
      if (aendr.availableTags) { await k.edit({ availableTags: aendr.availableTags, reason: '/setup' }).catch(e => rapport.push(`Tags ${opts.name}: ${e.message}`)); delete aendr.availableTags; }
      if (!k.flags?.has?.(ChannelFlags.RequireTag)) aendr.flags = ChannelFlags.RequireTag;
    }
    if (Object.keys(aendr).length) await k.edit({ ...aendr, reason: '/setup' }).catch(e => rapport.push(`${opts.name}: ${e.message}`));
    if (opts.permissionOverwrites && !sammeRet(k, opts.permissionOverwrites)) await k.permissionOverwrites.set(opts.permissionOverwrites, '/setup').catch(e => rapport.push(`Rettigheder ${opts.name}: ${e.message}`));
  }
  d.kanaler[noegle] = k.id;
  return k;
}

// Community (kræves til forummer og velkomstskærm) og sikkerhed som på HopDop HCF
async function saetCommunity(g, d, rapport) {
  const k = d.kanaler;
  const fund = id => id && g.channels.cache.has(id) ? id : undefined;
  const aendr = { preferredLocale: 'da', verificationLevel: 2, explicitContentFilter: 2, defaultMessageNotifications: 1,
    rulesChannel: fund(k.regler), publicUpdatesChannel: fund(k.staffchat) || fund(k.botlog), safetyAlertsChannel: fund(k.botlog) };
  if (!g.features.includes('COMMUNITY')) aendr.features = [...g.features, 'COMMUNITY'];
  Object.keys(aendr).forEach(n => aendr[n] === undefined && delete aendr[n]);
  await g.edit({ ...aendr, reason: 'Community-opsætning' }).catch(e => rapport.push(`Community: ${e.message}`));
}
// Velkomstskærm (vises til nye medlemmer, kræver Community)
async function saetVelkomst(g, d, rapport) {
  const k = d.kanaler;
  const fund = id => id && g.channels.cache.has(id) ? id : undefined;
  const velkomst = [['regler', '📜', 'Læs reglerne, og få adgang'], d.type === 'shop' ? ['produkter', '📦', 'Se alle vores produkter'] : ['serverip', '🌐', 'Server-IP og sådan joiner du'],
    d.type === 'shop' ? ['showcase', '🎬', 'Se vores scripts i aktion'] : ['nyheder', '📢', 'Seneste nyt'], ['chat', '💬', 'Snak med de andre'], ['ticket', '🎫', 'Brug for hjælp? Opret en ticket']]
    .filter(([n]) => fund(k[n]) && g.channels.cache.get(k[n])?.permissionsFor(g.roles.everyone)?.has(P.ViewChannel))
    .map(([n, e, t]) => ({ channel_id: k[n], description: t, emoji_name: e }));
  if (!velkomst.length) return;
  await g.client.rest.patch(`/guilds/${g.id}/welcome-screen`, { body: { enabled: true, description: d.type === 'shop' ? 'Scripts, showcases og custom-bestillinger. 🐐' : `Velkommen til ${navnPaa(g)}!`, welcome_channels: velkomst } })
    .catch(e => rapport.push(`Velkomstskærm: ${e.message}`));
}

// ---------- ONBOARDING (spørgsmål ved join) OG REGELSKÆRM ----------
const FUNDET = { titel: 'Hvordan fandt du serveren?', enkelt: true, krav: true, valg: [
  ['Fra: En ven', 'En ven', 'En ven inviterede mig', '🤝'], ['Fra: Minecraft', 'En Minecraft-server', 'Jeg så den på en server', '🎮'],
  ['Fra: TikTok/YouTube', 'TikTok eller YouTube', 'Fra en video', '🎥'], ['Fra: Google', 'Google', 'Jeg søgte på nettet', '🔎'],
  ['Fra: Discord', 'En anden Discord', 'Fra en anden Discord-server', '💬'], ['Fra: Andet', 'Andet', 'Noget helt andet', '❔']] };
const ONBOARDING = {
  shop: [FUNDET,
    { titel: 'Hvad vil du bruge serveren til?', enkelt: false, krav: true, valg: [
      ['Vil: Købe scripts', 'Købe færdige scripts', 'Se og købe vores produkter', '🛒'], ['Vil: Custom script', 'Bestille et custom script', 'Få lavet noget kun til dig', '✍️'],
      ['Vil: Se showcases', 'Se showcases', 'Se hvad vi har lavet', '🎬'], ['Vil: Support', 'Support', 'Hjælp til noget, jeg har købt', '🛠️'],
      ['Vil: Kigge', 'Bare kigge', 'Jeg kigger bare rundt', '👀']] },
    { titel: 'Hvilken type kunde er du?', enkelt: true, krav: true, valg: [
      ['Type: Serverejer', 'Serverejer', 'Jeg ejer eller driver en server', '👑'], ['Type: Udvikler', 'Udvikler eller skripter', 'Jeg laver selv scripts', '🧑‍💻'],
      ['Type: Staff', 'Staff på en server', 'Jeg er staff et sted', '🛡️'], ['Type: Spiller', 'Spiller', 'Jeg spiller bare', '🙋']] },
    { titel: 'Hvilken slags server er det til?', enkelt: false, krav: false, efter: true, valg: [
      ['Server: Prison', 'Prison', '', '🔒'], ['Server: KitPvP', 'KitPvP', '', '⚔️'], ['Server: HCF', 'HCF', '', '🏰'],
      ['Server: Minigames', 'Minigames', '', '🎮'], ['Server: Survival', 'Survival', '', '🌲'], ['Server: Andet', 'Andet', '', '🧺']] },
    { titel: 'Hvad vil du have besked om?', enkelt: false, krav: false, valg: [
      ['Ping: Nye produkter', 'Nye produkter', 'Når der kommer noget nyt', '🆕'], ['Ping: Udsalg', 'Udsalg', 'Når der er tilbud', '🏷️'],
      ['Ping: Opdateringer', 'Opdateringer', 'Når et produkt bliver opdateret', '🔄'], ['Ping: Giveaways', 'Giveaways', 'Når vi giver noget væk', '🎁']] }],
  prison: [FUNDET,
    { titel: 'Hvad vil du helst være?', enkelt: true, krav: true, valg: [
      ['Vil: Fange', 'Fange', 'Jeg vil spille som fange', '⛓️'], ['Vil: Vagt', 'Vagt', 'Jeg vil gerne være vagt', '👮'], ['Vil: Begge', 'Begge dele', 'Jeg prøver det hele', '🤷']] },
    { titel: 'Hvor meget spiller du?', enkelt: true, krav: false, valg: [
      ['Spiller: Hver dag', 'Hver dag', '', '🔥'], ['Spiller: Nogle gange', 'Et par gange om ugen', '', '📅'], ['Spiller: Sjældent', 'Engang imellem', '', '🌙']] },
    { titel: 'Hvad vil du have besked om?', enkelt: false, krav: false, valg: [
      ['Ping: Nyheder', 'Nyheder', 'Nyt på serveren', '📢'], ['Ping: Events', 'Events', 'Events og konkurrencer', '🎉'], ['Ping: Giveaways', 'Giveaways', 'Når vi giver noget væk', '🎁']] }],
};
ONBOARDING.kitpvp = ONBOARDING.uhc = ONBOARDING.andet = [FUNDET, ONBOARDING.prison[3]];
async function saetOnboarding(g, d, rapport) {
  const sp = ONBOARDING[d.type]; if (!sp) return;
  await g.roles.fetch();
  d.onboarding = d.onboarding || {};
  const prompts = [];
  for (const [pi, q] of sp.entries()) {
    const options = [];
    for (const [oi, [rolle, titel, besk, emoji]] of q.valg.entries()) {
      let r = d.onboarding[rolle] && g.roles.cache.get(d.onboarding[rolle]);
      if (!r) r = g.roles.cache.find(x => x.name === rolle && !x.managed) || await g.roles.create({ name: rolle, mentionable: false, hoist: false, permissions: [], reason: 'Onboarding-rolle' }).catch(e => { rapport.push(`Rolle ${rolle}: ${e.message}`); return null; });
      if (!r) continue;
      d.onboarding[rolle] = r.id;
      options.push({ id: String(1190000000000000000n + BigInt(pi * 100 + oi)), title: titel, ...(besk ? { description: besk } : {}), emoji_name: emoji, role_ids: [r.id], channel_ids: [] });
    }
    if (options.length) prompts.push({ id: String(1190000000000900000n + BigInt(pi)), type: 0, title: q.titel, single_select: q.enkelt, required: q.krav, in_onboarding: !q.efter, options });
  }
  gem();
  const synlig = id => id && g.channels.cache.get(id)?.permissionsFor(g.roles.everyone)?.has(P.ViewChannel);
  const standard = Object.values(d.kanaler).filter(synlig).filter(id => [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement].includes(g.channels.cache.get(id).type));
  await g.client.rest.put(`/guilds/${g.id}/onboarding`, { body: { enabled: true, mode: 0, default_channel_ids: standard, prompts } })
    .catch(e => rapport.push(`Onboarding: ${e.message} ${JSON.stringify(e.rawError?.errors || '').slice(0, 250)}`));
}
// Discords egen regelskærm: man skal acceptere reglerne, før man kan skrive. Bagefter får man automatisk Spiller.
async function saetRegelskaerm(g, d, rapport) {
  await g.client.rest.patch(`/guilds/${g.id}/member-verification`, { body: { enabled: true,
    description: `Velkommen til ${navnPaa(g)}! Læs og accepter reglerne for at få adgang.`,
    form_fields: [{ field_type: 'TERMS', label: 'Læs og accepter reglerne', required: true, values: reglerFor(d.type).map(x => x.replace(/^\*\*\d+\.\*\* /, '').replace(/\*\*/g, '').slice(0, 300)) }] } })
    .catch(e => rapport.push(`Regelskærm: ${e.message}`));
}

// Bygger/retter hele serveren efter skabelonen. Bruges af /setup og automatisk, når skabelonen bliver opdateret.
const SKABELON_V = 32;
async function byg(g, d, type) {
  const rapport = [];
  spor(`byg start ${g.name} (${type})`);
  for (const r of [...ROLLER.faelles, ...ROLLER[type]]) await sikrRolle(g, d, r);
  gem();
  await g.channels.fetch();
  const grupper = [...KANALER.start, ...KANALER[type], ...KANALER.slut].filter(gr => !gr.kun || gr.kun.includes(type));
  const forummer = [];
  for (const [nr, gr] of grupper.entries()) {
    const kat = await sikrKanal(g, d, `kat_${gr.id}`, { name: gr.kat, type: ChannelType.GuildCategory, position: nr,
      permissionOverwrites: gr.staff ? rettigheder(g, d, {}, true) : undefined }, rapport);
    if (!kat) continue;
    for (const k of gr.kanaler.filter(k => !k.ikke?.includes(type) && (!k.kun || k.kun.includes(type)))) {
      const opts = { name: k.navn, type: k.voice ? ChannelType.GuildVoice : ChannelType.GuildText, parent: kat.id,
        permissionOverwrites: rettigheder(g, d, k, gr.staff), ...(k.voice ? {} : { topic: k.topic || '', rateLimitPerUser: k.slow || 0 }) };
      if (k.forum) { forummer.push([k, opts]); continue; }
      await sikrKanal(g, d, k.n, opts, rapport);
    }
    gem();
  }
  // Den gamle #kunde-support er erstattet af #hjælp-hinanden
  if (d.kanaler.kundesupport) {
    const ks = await g.channels.fetch(d.kanaler.kundesupport).catch(() => null);
    const msgs = ks && await ks.messages.fetch({ limit: 5 }).catch(() => null);
    if (ks && (!msgs || ![...msgs.values()].some(m => !m.author.bot))) await ks.delete('Erstattet af #hjælp-hinanden').catch(() => {});
    else if (ks) await ks.setName('kunde-support-gammel').catch(() => {});
    delete d.kanaler.kundesupport; gem();
  }
  // Discords gamle standardkanaler (#generel, Generel og deres kategorier) fra da serveren blev lavet
  await g.channels.fetch();
  const vores = new Set(Object.values(d.kanaler));
  const STANDARD_KAT = ['Tekstkanaler', 'Talekanaler', 'Text Channels', 'Voice Channels'];
  for (const c of [...g.channels.cache.values()]) {
    if (vores.has(c.id) || ![ChannelType.GuildText, ChannelType.GuildVoice].includes(c.type) || !/^gener(e|a)l$/i.test(c.name)) continue;
    if (c.parent && !STANDARD_KAT.includes(c.parent.name)) continue;
    await c.delete('Gammel standardkanal').then(() => spor(`slettet ${c.name} på ${g.name}`)).catch(e => rapport.push(`Slet ${c.name}: ${e.message}`));
  }
  for (const c of [...g.channels.cache.values()]) {
    if (c.type === ChannelType.GuildCategory && STANDARD_KAT.includes(c.name) && !vores.has(c.id) && !g.channels.cache.some(x => x.parentId === c.id))
      await c.delete('Tom standardkategori').catch(e => rapport.push(`Slet ${c.name}: ${e.message}`));
  }
  // Rækkefølge på kategorierne
  spor(`${g.name}: kanaler ok`);
  await g.channels.setPositions([...(d.kanaler.stat_kat ? [{ channel: d.kanaler.stat_kat, position: 0 }] : []),
    ...grupper.map((gr, i) => d.kanaler[`kat_${gr.id}`] && { channel: d.kanaler[`kat_${gr.id}`], position: i + 1 }).filter(Boolean)]).catch(() => {});
  await saetCommunity(g, d, rapport);
  spor(`${g.name}: community ok`);
  // Forummer med galleri (kræver Community)
  for (const [k, opts] of forummer) {
    await sikrKanal(g, d, k.n, { ...opts, type: ChannelType.GuildForum, defaultForumLayout: 2 /* galleri */, defaultSortOrder: 1, flags: ChannelFlags.RequireTag,
      availableTags: k.forum.tags.map(([name, emoji]) => ({ name, emoji: { id: null, name: emoji }, moderated: false })),
      defaultReactionEmoji: { id: null, name: k.forum.reaktion } }, rapport)
      || await sikrKanal(g, d, k.n, opts, rapport); // uden Community: almindelig kanal i stedet
  }
  gem();
  await saetVelkomst(g, d, rapport);
  await saetOnboarding(g, d, rapport);
  await saetRegelskaerm(g, d, rapport);
  spor(`${g.name}: forummer+velkomst ok`);
  await ordnRoller(g, d, type, rapport);
  spor(`${g.name}: roller ok. ${rapport.join(' | ')}`);
  d.skabelonV = SKABELON_V; gem();
  return rapport;
}

// ---------- /setup ----------
async function setup(i, type, navn) {
  const g = i.guild;
  const d = data[g.id] = data[g.id] || { roller: {}, kanaler: {} };
  d.type = type; if (navn) d.navn = navn; d.ip = d.ip || '';
  const t = TYPER[type];
  await i.editReply(`⏳ Sætter **${navnPaa(g)}** op som **${t.navn}**-server. Det tager et øjeblik ...`);
  const rapport = await byg(g, d, type);
  await postPaneler(g, d);
  d.sat = new Date().toISOString(); gem();
  await log(g, '🛠️ Serveren er sat op', [`${i.user} kørte **/setup** (${t.navn}).`, '', ...rapportLinjer(rapport)], rapport.length ? 0xf59e0b : 0x22c55e);
  return i.editReply([
    `✅ **${navnPaa(g)}** er sat op som **${t.navn}**-server!`, '',
    `• Roller: ${[...ROLLER.faelles, ...ROLLER[type]].map(r => `<@&${d.roller[r.navn]}>`).join(' ')}`,
    `• Regler med verificerings-knap: <#${d.kanaler.regler}>`,
    `• Ticket-panel: <#${d.kanaler.ticket}>`,
    ...(rapport.length ? ['', ...rapportLinjer(rapport).slice(0, 8)] : []), '',
    '**Husk:**',
    '**1.** Giv dig selv rollen **Ejer**.',
    ...(type === 'shop' ? [] : ['**2.** Sæt Minecraft-IP\'en, når serveren er klar: `/indstil ip:<ip>`']),
    `**${type === 'shop' ? 2 : 3}.** Kør bare \`/setup\` igen, hvis noget mangler. Botten genbruger det, der allerede findes.`,
  ].join('\n').slice(0, 2000));
}

async function sendEllerRet(kanal, besked) {
  // Panelet er bottens ÆLDSTE besked i kanalen (forslag, anmeldelser og boost-beskeder kommer efter)
  const d = info(kanal.guild); if (d) d.paneler = d.paneler || {};
  let gammel = d?.paneler[kanal.id] && await kanal.messages.fetch(d.paneler[kanal.id]).catch(() => null);
  if (!gammel) gammel = [...((await kanal.messages.fetch({ limit: 50 }).catch(() => null))?.values() || [])].filter(m => m.author.id === kanal.client.user.id && m.embeds.length).pop();
  const ny = gammel ? await gammel.edit(besked).catch(() => kanal.send(besked)) : await kanal.send(besked);
  if (d && ny?.id && d.paneler[kanal.id] !== ny.id) { d.paneler[kanal.id] = ny.id; gem(); }
  return ny;
}

function reklameGuide(d, navn) {
  return new EmbedBuilder().setColor(0xf59e0b).setAuthor({ name: navn }).setTitle('📣 Reklame: vis din server frem!')
    .setDescription([
      'Har du en Discord-server, Minecraft-server eller et projekt? Tryk på **Nyt opslag**, og få nye medlemmer. 🚀', '',
      '### 📋 Regler',
      '> 📌 **Ét opslag pr. person.** Har du allerede et, så ret i det i stedet for at lave et nyt',
      '> 🏷️ Vælg et **tag**, og brug navnet på din server som **titel**',
      '> 🔗 Opslaget **skal** have et Discord-invite, der ikke udløber',
      '> 🚫 Ingen NSFW, scam, leaks, @everyone/@here eller rolle-pings',
      '> 📩 Ingen reklame i DM eller i andre kanaler',
      '',
      '### ✨ Sådan laver du et opslag, der virker',
      '**1.** Giv opslaget en **fængende titel** og en stærk første linje. Det er dem, folk ser i galleriet.',
      '**2.** Fortæl **hvad** I er, og **hvem** det er for (sprog, version, gamemode).',
      '**3.** Skriv 3-5 **konkrete grunde** til at joine. Tal og navne virker bedre end "sjov server".',
      '**4.** Slut af med **IP/hjemmeside** og **Discord-link**.',
      '**5.** Brug emojis og **fed skrift**, men hold det kort. Under 15 linjer er bedst.',
      '**6.** 🖼️ **Vedhæft et billede eller banner!** Det bliver forsidebilledet på dit kort i galleriet.',
      '',
      '### ✍️ Skabelon (kopiér og udfyld)',
      '```',
      '[1-2 linjer om hvad I er]',
      '',
      '**✨ Hvorfor joine?**',
      '> ✅ [grund 1]',
      '> ✅ [grund 2]',
      '> ✅ [grund 3]',
      '',
      '🌐 **IP/side:** [ip eller hjemmeside]',
      '💬 **Discord:** [invite-link]',
      '```',
      '📎 Husk at vedhæfte et **billede/banner** til opslaget.',
      '👇 Se et færdigt eksempel herunder.',
      `🤝 Vil du have et fast samarbejde i stedet? Se <#${d.kanaler.partnere || ''}>.`,
    ].join('\n'));
}

function reklameEksempel(d) {
  // Shoppen må aldrig nævne HopDop, så den får et opdigtet eksempel
  const e = d.type === 'shop' ? [
    '**Titel:** 🏔️ Bjergriget Survival | Byg. Handl. Herske.', '',
    'Dansk survival-server på 1.21, hvor spillerne selv bygger byerne og styrer økonomien.',
    '',
    '**✨ Hvorfor joine?**',
    '> 🏙️ Byg din egen by med venner og inviter borgere',
    '> 💰 Spillerdrevet økonomi med auktionshus og jobs',
    '> 🎉 Ugentlige events med rigtige præmier',
    '> 🇩🇰 Dansk staff, der svarer hurtigt',
    '',
    '🌐 **IP:** play.eksempel.dk',
    '💬 **Discord:** discord.gg/eksempel',
    '🖼️ *+ vedhæftet banner af serveren*',
  ] : [
    '**Titel:** ⚔️ HOPDOP | Rigtig 1.8 PvP. Kun for de bedste.', '',
    'Dansk **HCF Kits**-server på **1.8.9**. Lav dit team, find allierede, og tag KOTH.',
    '',
    '**✨ Hvorfor joine?**',
    '> 🗡️ **5 kits:** Diamond, Bard, Archer, Rogue og Reaper',
    '> 👑 **KOTH hvert 20. minut:** vind **$5.000 + KOTH-kisten** til dit team',
    '> 🛡️ **Teams** med alliancer, team-bank og team-levels',
    '> ⏱️ Timere på scoreboardet: combat-tag, pearl, archer tag og bard-energi',
    '> 🔥 **Daily streak:** jo længere streak, jo bedre rewards',
    '> 🏆 Leaderboards, duels, anticheat og aktivt staff',
    '',
    '🌐 **IP:** `hopdop.superawesome.dk`',
    '🖥️ **Hjemmeside:** hopdop.pages.dev',
    '💬 **Discord:** discord.gg/53fAaeMGqP',
    '🖼️ *+ vedhæftet banner af serveren*',
  ];
  return new EmbedBuilder().setColor(0x22c55e).setTitle('👀 Eksempel på et godt opslag').setDescription(e.join('\n'))
    .setFooter({ text: 'Fængende start, konkrete grunde, et flot billede og links, der virker. Sådan får du flest joins.' });
}

// Tjekker nye reklame-opslag: skal have et Discord-invite. Ellers slettes det med en kort forklaring.
async function tjekReklame(m, d) {
  const harInvite = /(discord\.gg|discord(app)?\.com\/invite)\/[a-z0-9-]+/i.test(m.content || '') || m.embeds?.some(e => /discord\.gg|discord(app)?\.com\/invite/i.test(`${e.url} ${e.description}`));
  if (harInvite) { await m.react('📣').catch(() => {}); return; }
  if (erStaff(m.member, d)) return;
  await m.delete().catch(() => {});
  const svarB = await m.channel.send({ content: `${m.author} ❌ Dit opslag blev fjernet, fordi det mangler et **Discord-invite** (fx discord.gg/...). Se guiden øverst i kanalen, og husk linket, når du må poste igen.`, allowedMentions: { users: [m.author.id] } }).catch(() => null);
  if (svarB) setTimeout(() => svarB.delete().catch(() => {}), 15000);
}

// Fastgjort guide-opslag i reklame-forummet (eller en almindelig besked, hvis det ikke er et forum)
async function reklamePanel(g, d, rk, navn) {
  const besked = { embeds: [reklameGuide(d, navn), reklameEksempel(d)] };
  if (rk.type !== ChannelType.GuildForum) return sendEllerRet(rk, besked);
  d.paneler = d.paneler || {};
  let t = d.paneler.reklame_traad && await g.channels.fetch(d.paneler.reklame_traad).catch(() => null);
  if (t?.parentId !== rk.id) t = null;
  if (t) {
    if (t.archived) await t.setArchived(false).catch(() => {});
    const start = await t.fetchStarterMessage().catch(() => null);
    if (start) await start.edit(besked).catch(() => {});
  } else {
    t = await rk.threads.create({ name: '📌 Sådan laver du et godt opslag', message: besked, appliedTags: (rk.availableTags || []).filter(x => x.name === 'Andet').map(x => x.id), reason: 'Reklame-guide' }).catch(e => { spor(`reklame-guide: ${e.message}`); return null; });
    if (!t) return;
    d.paneler.reklame_traad = t.id; gem();
  }
  if (!t.flags?.has?.(ChannelFlags.Pinned)) await t.pin('Reklame-guide').catch(e => spor(`reklame-pin: ${e.message}`));
  if (!t.locked) await t.setLocked(true).catch(() => {});
}

// Nyt opslag i reklame-forummet: skal have et Discord-invite, og man må kun have ét opslag
async function tjekReklame(t, d) {
  if (t.id === d.paneler?.reklame_traad) return;
  const g = t.guild, m = await g.members.fetch(t.ownerId).catch(() => null);
  if (!m || m.user.bot || erStaff(m, d)) return;
  await new Promise(r => setTimeout(r, 1500));
  const start = await t.fetchStarterMessage().catch(() => null);
  const tekst = `${t.name} ${start?.content || ''} ${(start?.embeds || []).map(e => `${e.url} ${e.description}`).join(' ')}`;
  const harInvite = /(discord\.gg|discord(app)?\.com\/invite)\/[a-z0-9-]+/i.test(tekst);
  const forum = await g.channels.fetch(t.parentId).catch(() => null);
  const aktive = forum ? await forum.threads.fetchActive().catch(() => null) : null;
  const gammel = aktive && [...aktive.threads.values()].find(x => x.parentId === t.parentId && x.ownerId === t.ownerId && x.id !== t.id);
  let grund = null;
  if (gammel) grund = `du har allerede et opslag: ${gammel.url}\nRet i det i stedet (tryk på ••• → Rediger), eller slet det gamle først.`;
  else if (!harInvite) grund = 'det mangler et **Discord-invite** (fx discord.gg/...). Læs det fastgjorte opslag øverst i forummet.';
  if (!grund) { if (start) await start.react('📣').catch(() => {}); return; }
  await t.delete('Reklame-regler').catch(() => {});
  spor(`${g.name}: fjernede reklame fra ${m.user.tag} (${gammel ? 'har allerede et' : 'mangler invite'})`);
  await m.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setAuthor({ name: navnPaa(g) }).setTitle('📣 Dit reklame-opslag blev fjernet')
    .setDescription(`Dit opslag **${t.name}** blev fjernet, fordi ${grund}`)] }).catch(() => {});
}

// ---------- Produktopslag fra opslag.json (lægges på hosten, ikke i git) ----------
// [{ id, type: 'shop', kanal: 'produkter', titel, tags: ['Plugin', ...], tekst, billeder: [url, ...] }]
// Nyt id = nyt opslag. Samme id igen = teksten, titlen og tags rettes i det eksisterende opslag.
async function postOpslag(client) {
  let koe; try { koe = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'opslag.json'), 'utf8')); } catch { return; }
  for (const o of Array.isArray(koe) ? koe : []) {
    for (const g of client.guilds.cache.values()) {
      const d = info(g); if (!d?.sat || d.type !== o.type) continue;
      const forum = d.kanaler[o.kanal] && await g.channels.fetch(d.kanaler[o.kanal]).catch(() => null);
      if (!forum || forum.type !== ChannelType.GuildForum) continue;
      let tekst = String(o.tekst || '').replace(/\{ticket\}/g, d.kanaler.ticket ? `<#${d.kanaler.ticket}>` : '#opret-ticket');
      // {@navn} bliver til et tag af personen, hvis vedkommende er på serveren
      for (const [hel, navn] of [...tekst.matchAll(/\{@([^}]+)\}/g)]) {
        const fundet = await g.members.search({ query: navn, limit: 5 }).catch(() => null);
        const m = fundet && [...fundet.values()].find(x => [x.user.username, x.user.globalName, x.displayName].some(n => n && n.toLowerCase().startsWith(navn.toLowerCase())));
        tekst = tekst.replace(hel, m ? `<@${m.id}>` : `**@${navn}**`);
      }
      tekst = tekst.slice(0, 2000);
      const tags = forum.availableTags.filter(t => (o.tags || []).includes(t.name)).map(t => t.id).slice(0, 5);
      d.opslag = d.opslag || {};
      const gl = d.opslag[o.id] && await g.channels.fetch(d.opslag[o.id]).catch(() => null);
      try {
        if (gl) {
          const start = await gl.fetchStarterMessage().catch(() => null);
          if (start && start.content !== tekst) await start.edit({ content: tekst });
          if (gl.name !== o.titel) await gl.setName(o.titel.slice(0, 100));
          if (tags.join() !== gl.appliedTags.join()) await gl.setAppliedTags(tags);
          continue;
        }
        const filer = (o.billeder || []).slice(0, 10).map((u, i) => ({ attachment: u, name: `${o.id}-${i + 1}.${(u.match(/\.(png|jpe?g|gif|webp)/i) || [, 'png'])[1]}` }));
        const lav = msg => forum.threads.create({ name: o.titel.slice(0, 100), appliedTags: tags, reason: 'Produktopslag', message: msg });
        const t = await lav({ content: tekst, files: filer }).catch(async e => {
          spor(`opslag ${o.id}: billederne kunne ikke uploades (${e.message}), poster med links i stedet`);
          const t2 = await lav({ content: tekst });
          if (o.billeder?.length) await t2.send({ content: o.billeder.join('\n') }).catch(() => {});
          return t2;
        });
        d.opslag[o.id] = t.id; gem();
        spor(`${g.name}: postede opslaget "${o.titel}" i ${forum.name}`);
        await log(g, '📦 Nyt opslag', [`**${o.titel}** er lagt op i ${forum}.`, t.url], 0x22c55e).catch(() => {});
      } catch (e) { spor(`opslag ${o.id}: ${e.message}`); }
    }
  }
}

// ---------- Prisliste i #priser (shop) ----------
const PRISER = [
  ['🛍️ Færdige produkter', 0x22c55e, [['🧩', 'Små scripts', '29–79 kr.', 'Én funktion, fx en kommando eller et simpelt event.'],
    ['📋', 'Systemer med menuer', '79–149 kr.', 'Flere menuer og indstillinger, fx Straf.'],
    ['🏰', 'Store systemer og plugins', '149–299 kr.', 'Mange dele, der spiller sammen, fx Teams med KOTH.']]],
  ['✍️ Custom-bestillinger', 0x3b82f6, [['✍️', 'Lille custom script', 'fra 99 kr.', 'En enkelt funktion lavet til din server.'],
    ['⚙️', 'Custom system', 'fra 249 kr.', 'Et helt system med menuer, data og indstillinger.'],
    ['🏗️', 'Stort projekt', 'fra 499 kr.', 'Større plugins eller en hel opsætning af din server.']]],
  ['🎁 Ekstra og rabatter', 0xa855f7, [['➕', 'Tilføjelse til et købt produkt', 'fra 49 kr.', 'Ny funktion eller ændring i noget, du har købt.'],
    ['🛠️', 'Hjælp til opsætning', '49 kr.', 'Vi hjælper med at få produktet til at køre på din server.'],
    ['⚡', 'Hastebestilling', '+50 % på prisen', 'Custom-opgaven bliver lavet før alt andet.'],
    ['🎁', 'Køb 2+ produkter på én gang', '15 % rabat', 'Rabat, når du køber flere produkter på én gang.']]],
];
// Én enkel, almindelig besked (ingen embeds)
function prisBesked(g, d) {
  let produkter = [];
  try { produkter = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'opslag.json'), 'utf8')).filter(o => o.type === d.type && o.kanal === 'produkter'); } catch {}
  const navnPaaProdukt = o => o.titel.replace(/^\S+\s+/, '').split('|')[0].trim();
  const linjer = [
    '# 💰 Priser', '',
    '**Færdige produkter**',
    ...PRISER[0][2].map(([, n, p]) => `${n}: **${p}**`), '',
    '**Custom (lavet til din server)**',
    ...PRISER[1][2].map(([, n, p]) => `${n}: **${p}**`), '',
    '**Ekstra**',
    ...PRISER[2][2].map(([, n, p]) => `${n}: **${p}**`),
  ];
  if (produkter.length) linjer.push('', '**Vores produkter lige nu**', ...produkter.map(o => {
    const pris = (String(o.tekst).match(/Pris:\**\s*([^\n*]+)/) || [])[1]?.trim() || 'pris i ticket';
    return `${d.opslag?.[o.id] ? `<#${d.opslag[o.id]}>` : navnPaaProdukt(o)}: **${pris}**`;
  }));
  linjer.push('', `Vil du købe noget? Opret en ticket i ${d.kanaler.ticket ? `<#${d.kanaler.ticket}>` : '#opret-ticket'}. Betaling aftales i ticketten.`);
  return { content: linjer.join('\n'), embeds: [], allowedMentions: { parse: [] } };
}

async function postPaneler(g, d) {
  const f = farve(g), navn = navnPaa(g);
  const regler = await g.channels.fetch(d.kanaler.regler).catch(() => null);
  if (regler) await sendEllerRet(regler, {
    embeds: reglerEmbeds(d, navn, f),
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('nv_verify').setLabel('Jeg accepterer reglerne').setEmoji('✅').setStyle(ButtonStyle.Success))],
  });
  const ticket = await g.channels.fetch(d.kanaler.ticket).catch(() => null);
  if (ticket) await sendEllerRet(ticket, {
    embeds: [new EmbedBuilder().setColor(f).setAuthor({ name: navn }).setTitle('🎫 Opret en ticket')
      .setDescription(TICKET_TEKST[d.type] || TICKET_TEKST.standard)],
    components: [new ActionRowBuilder().addComponents(...TICKETS[d.type].map(([id, label, emoji]) =>
      new ButtonBuilder().setCustomId(`nv_tk_${id}`).setLabel(label).setEmoji(emoji).setStyle(id === 'anmeld' ? ButtonStyle.Danger : ButtonStyle.Primary)))],
  });
  const fo = d.kanaler.forslag && await g.channels.fetch(d.kanaler.forslag).catch(() => null);
  if (fo) await sendEllerRet(fo, { embeds: [new EmbedBuilder().setColor(0x57f287).setAuthor({ name: navn }).setTitle('💡 Sådan laver du et forslag')
    .setDescription(`Gå ind i ${d.kanaler.botkmd ? `<#${d.kanaler.botkmd}>` : '#bot-kommandoer'} og skriv **/forslag**.\nUdfyld formularen, så kommer dit forslag herind.\n\nStem på andres forslag med ✅ og ❌. Staff svarer, og du får en besked, når dit forslag er godkendt eller afvist.`)] });
  await opdaterAnmPanel(g, d);
  const ticketLink = d.kanaler.ticket ? `<#${d.kanaler.ticket}>` : '#opret-ticket';
  const pa = d.kanaler.partnere && await g.channels.fetch(d.kanaler.partnere).catch(() => null);
  if (pa) await sendEllerRet(pa, { embeds: [new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: navn }).setTitle('🤝 Bliv samarbejdspartner')
    .setDescription([
      'Har du en Discord-server, en Minecraft-server eller et projekt, der passer til os? Så lad os hjælpe hinanden!', '',
      '**🎁 Det får du**',
      '• Din server bliver vist her i kanalen med beskrivelse og invite-link.',
      '• Vi deler gerne jeres nyheder og events med vores community.', '',
      '**✅ Det kigger vi efter**',
      '• En aktiv server med en god tone.',
      '• Ingen NSFW, scam eller leaks.',
      '• At I også viser os frem hos jer.', '',
      '**📝 Sådan ansøger du**',
      `**1.** Gå til ${ticketLink}, og tryk på **🤝 Samarbejde**.`,
      '**2.** Send jeres **invite-link**, en kort **beskrivelse** og hvor mange **medlemmer** I har.',
      '**3.** Staff kigger på det og vender tilbage i ticketten.',
      '**4.** Bliver I godkendt, kommer I på listen herunder. 🎉',
    ].join('\n'))] });
  const pr = d.type === 'shop' && d.kanaler.priser && await g.channels.fetch(d.kanaler.priser).catch(() => null);
  if (pr) await sendEllerRet(pr, prisBesked(g, d)).catch(e => spor(`priser: ${e.message}`));
  const hj = d.kanaler.hjaelp && await g.channels.fetch(d.kanaler.hjaelp).catch(() => null);
  if (hj) await sendEllerRet(hj, { embeds: [new EmbedBuilder().setColor(0x3b82f6).setAuthor({ name: navn }).setTitle('🤝 Sådan får du hjælp her')
    .setDescription([
      '**Skriv dit spørgsmål i en TRÅD, ikke direkte i kanalen.** 🧵',
      'I selve kanalen er der **10 minutters cooldown**. I tråde er der **ingen cooldown**.', '',
      '**📝 Sådan laver du en tråd**',
      '**1.** Tryk på **#** (tråd-ikonet) øverst til højre i kanalen, eller **+** ved siden af skrivefeltet.',
      '**2.** Vælg **Opret tråd**, og giv den et navn, fx *"Hjælp med mit script"*.',
      '**3.** Skriv dit spørgsmål inde i tråden. 🎉', '',
      '**💡 Godt at vide**',
      '• Skriver du direkte i kanalen, laver botten automatisk en tråd til dig.',
      '• I tråden må du **tagge** folk og sende **billeder**.',
      '• Hjælp gerne andre i deres tråde. 💙',
    ].join('\n'))] });
  const rk = d.kanaler.reklame && await g.channels.fetch(d.kanaler.reklame).catch(() => null);
  if (rk) await reklamePanel(g, d, rk, navn).catch(e => spor(`reklame-panel: ${e.message}`));
  const guide = d.kanaler.guide && await g.channels.fetch(d.kanaler.guide).catch(() => null);
  if (guide) await sendEllerRet(guide, { embeds: [new EmbedBuilder().setColor(f).setAuthor({ name: navn }).setTitle('✅ Sådan kommer du ind')
    .setDescription([
      'Du kan kun se denne kategori, fordi du ikke er verificeret endnu. Det tager under et minut:', '',
      '**1.** Svar på de få spørgsmål, Discord viser dig, når du joiner.',
      `**2.** Læs og **accepter reglerne** (${d.kanaler.regler ? `<#${d.kanaler.regler}>` : '#regler'}).`,
      '**3.** Så får du automatisk adgang til hele serveren. 🎉', '',
      `Virker det ikke? Tryk på knappen i ${d.kanaler.regler ? `<#${d.kanaler.regler}>` : '#regler'}, eller skriv i ${d.kanaler.spoergsmaal ? `<#${d.kanaler.spoergsmaal}>` : '#spørgsmål'}, så hjælper staff dig.`,
    ].join('\n'))] });
  await opdaterIp(g, d);
}

async function opdaterIp(g, d) {
  const k = d.kanaler.serverip && await g.channels.fetch(d.kanaler.serverip).catch(() => null);
  if (!k) return;
  await sendEllerRet(k, { embeds: [new EmbedBuilder().setColor(farve(g)).setAuthor({ name: navnPaa(g) }).setTitle('🌐 Server-IP')
    .setDescription(d.ip
      ? [`**IP:** \`${d.ip}\``, '', '**Sådan joiner du:**', '**1.** Åbn Minecraft, og gå til **Multiplayer**.', '**2.** Tryk på **Tilføj server**, og skriv IP\'en ovenfor.', '**3.** Join serveren, og hav det sjovt!'].join('\n')
      : '⏳ Serveren er ikke åben endnu. IP\'en kommer her, så snart den er klar!')] });
}

// Invite-links til serverne (botten finder selv ud af, hvilken server et link hører til)
const INVITE_KODER = ['EaDhda9TjA'];
async function findInvites(client) {
  for (const kode of INVITE_KODER) {
    const inv = await client.fetchInvite?.(kode)?.catch(() => null);
    const d = inv?.guild && data[inv.guild.id];
    if (d && d.invite !== `https://discord.gg/${kode}`) { d.invite = `https://discord.gg/${kode}`; gem(); spor(`invite ${kode} -> ${inv.guild.name}`); }
  }
}
// Bot-log: korte, forståelige beskeder (tekniske detaljer gemmes kun i netvaerk-log.txt)
async function log(g, titel, linjer = [], farveKode = 0x64748b) {
  const d = info(g);
  const k = d?.kanaler?.botlog && await g.channels.fetch(d.kanaler.botlog).catch(() => null);
  if (!k) return;
  const e = new EmbedBuilder().setColor(farveKode).setTitle(titel).setTimestamp();
  if (linjer.length) e.setDescription(linjer.join('\n').slice(0, 4000));
  await k.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}
// Oversætter tekniske fejl til noget, man kan forstå og gøre noget ved
function forklar(x) {
  spor(`problem: ${x}`);
  const hvad = x.split(':')[0];
  if (/Missing Permissions|Missing Access/i.test(x)) return `**${hvad}**: botten mangler rettigheder. Træk bottens rolle helt op øverst under *Serverindstillinger → Roller*.`;
  if (/rate limit/i.test(x)) return `**${hvad}**: Discord bad botten vente lidt. Det bliver prøvet igen ved næste genstart.`;
  if (/^Onboarding/.test(x)) return '**Onboarding**: spørgsmålene for nye medlemmer kunne ikke gemmes. Knappen i #regler virker stadig.';
  if (/^Regelskærm/.test(x)) return '**Regelskærm**: Discords regel-accept kunne ikke slås til. Knappen i #regler virker stadig.';
  if (/^Velkomstskærm/.test(x)) return '**Velkomstskærm**: kunne ikke sættes (det er kun pynt, alt andet virker).';
  if (/^Community/.test(x)) return '**Community**: kunne ikke slås til. Forummer og onboarding kræver Community.';
  return `**${hvad}**: gik ikke helt (${x.slice(hvad.length + 1, hvad.length + 90).trim()}).`;
}
const rapportLinjer = rapport => rapport.length ? ['⚠️ **Det skal du kigge på:**', ...rapport.map(x => `• ${forklar(x)}`)] : ['✅ Alt gik som det skulle.'];

// ---------- STATS (som på HopDop HCF, bare uden IP) ----------
async function opdaterStats(g, d) {
  if (!d?.sat) return;
  const staff = STAFF_ROLLER.map(r => d.roller[r]).filter(Boolean);
  const ow = [{ id: g.roles.everyone.id, allow: [P.ViewChannel], deny: [P.Connect] }, ...staff.map(id => ({ id, allow: [P.ViewChannel], deny: [P.Connect] }))];
  let kat = d.kanaler.stat_kat && await g.channels.fetch(d.kanaler.stat_kat).catch(() => null);
  if (!kat) {
    kat = await g.channels.create({ name: '[ 📊 | STATS ]', type: ChannelType.GuildCategory, position: 0, permissionOverwrites: ow }).catch(e => { spor(`stats ${g.name}: ${e.message}`); return null; });
    if (!kat) return;
    d.kanaler.stat_kat = kat.id; gem();
    await kat.setPosition(0).catch(() => {});
  }
  await g.members.fetch().catch(() => {});
  const antalMed = navn => d.roller[navn] ? (g.roles.cache.get(d.roller[navn])?.members.size ?? 0) : 0;
  const linjer = [['stat_med', `👥┃Medlemmer: ${g.memberCount}`]];
  if (d.type === 'shop') {
    linjer.push(['stat_kunder', `🛒┃Kunder: ${antalMed('Kunde')}`]);
    let produkter = 0;
    for (const n of ['produkter', 'showcase']) {
      const forum = d.kanaler[n] && await g.channels.fetch(d.kanaler[n]).catch(() => null);
      if (!forum?.threads) continue;
      const aktive = await forum.threads.fetchActive().catch(() => null);
      const arkiv = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
      produkter += (aktive?.threads.filter(t => t.parentId === forum.id).size || 0) + (arkiv?.threads.size || 0);
    }
    linjer.push(['stat_produkter', `📦┃Produkter: ${produkter}`]);
    const { snit, antal } = anmSnit(d);
    linjer.push(['stat_anm', antal ? `⭐┃Bedømmelse: ${komma(snit)}/5 (${antal})` : '⭐┃Bedømmelse: ingen endnu']);
    linjer.push(['stat_web', '🌐┃gederneshop.pages.dev']);
  } else if (d.type === 'prison') linjer.push(['stat_vagter', `👮┃Vagter: ${antalMed('Vagt')}`]);
  for (const [n, navn] of linjer) {
    let c = d.kanaler[n] && await g.channels.fetch(d.kanaler[n]).catch(() => null);
    if (!c) {
      c = await g.channels.create({ name: navn, type: ChannelType.GuildVoice, parent: kat.id, permissionOverwrites: ow }).catch(e => { spor(`stats ${navn}: ${e.message}`); return null; });
      if (c) { d.kanaler[n] = c.id; gem(); }
    } else if (c.name !== navn) await c.setName(navn).catch(() => {}); // Discord tillader 2 omdøbninger pr. 10 min
  }
}

// Opdatér stats kort efter en ændring (samler flere ændringer, Discord tillader 2 omdøbninger pr. 10 min pr. kanal)
const statsTimer = new Map();
function statsSnart(g) {
  if (statsTimer.has(g.id)) return;
  statsTimer.set(g.id, setTimeout(() => { statsTimer.delete(g.id); opdaterStats(g, info(g)).catch(e => spor(`stats: ${e.message}`)); }, 15000));
}

// ---------- BOOSTS (som på HopDop HCF) ----------
const BOOST_TRIN = [
  { n: 1, titel: 'Første boost', discord: [], os: ['💜 Booster-rolle, der vises for sig i medlemslisten', '💜 Adgang til booster-lounge og Booster-snak', '🎨 Egen rollefarve med /boosterfarve', '😎 Brug emojis og stickers fra andre servere'] },
  { n: 2, titel: 'Niveau 1', discord: ['50 ekstra emoji-pladser (100 i alt)', 'Animeret server-ikon', 'Invite-baggrund', 'Bedre lyd (128 kbps)'], os: [] },
  { n: 7, titel: 'Niveau 2', discord: ['Server-banner øverst i kanallisten', 'Rolleikoner', '150 emoji-pladser', 'Bedre lyd (256 kbps)', 'Uploads op til 50 MB'], os: [] },
  { n: 14, titel: 'Niveau 3', discord: ['Eget invite-link (vanity URL)', 'Animeret banner', '250 emoji-pladser', 'Bedste lyd (384 kbps)', 'Uploads op til 100 MB'], os: [] },
];
const bjaelke = (a, b, bredde = 14) => { const f = Math.max(0, Math.min(bredde, Math.round(a / b * bredde))); return '█'.repeat(f) + '░'.repeat(bredde - f); };
async function synkBoostere(g, d) {
  const r = d?.roller?.Booster && g.roles.cache.get(d.roller.Booster); if (!r) return;
  const medl = await g.members.fetch().catch(() => g.members.cache);
  d.boost = d.boost || { farver: {} };
  for (const m of medl.values()) {
    if (m.user.bot) continue;
    const bo = !!m.premiumSince;
    if (bo && !m.roles.cache.has(r.id)) await m.roles.add(r, 'Booster serveren').catch(() => {});
    if (!bo && m.roles.cache.has(r.id)) await m.roles.remove(r, 'Booster ikke længere').catch(() => {});
    if (!bo && d.boost.farver?.[m.id]) { await g.roles.cache.get(d.boost.farver[m.id])?.delete('Booster ikke længere').catch(() => {}); delete d.boost.farver[m.id]; gem(); }
  }
}
async function opdaterBoosts(g, d) {
  const k = d?.kanaler?.boosts && await g.channels.fetch(d.kanaler.boosts).catch(() => null); if (!k) return;
  g = await g.fetch().catch(() => g);
  const n = g.premiumSubscriptionCount || 0, niv = g.premiumTier || 0;
  const flertal = x => `${x} boost${x === 1 ? '' : 's'}`;
  const naeste = BOOST_TRIN.find(t => t.n > n);
  const linjer = [`🔮 Boosts lige nu: **${n}**`, `⭐ Discord-niveau: **${niv}**`, `\`${bjaelke(n, 14)}\` **${n}/14**`, ''];
  if (naeste) linjer.push(`⬆️ **Næste mål: ${naeste.titel}** (mangler **${flertal(naeste.n - n)}**)`, ...[...naeste.discord, ...naeste.os].map(x => `• ${x}`));
  else linjer.push('⬆️ **Serveren er på max niveau!** Tusind tak! 💜');
  const e = new EmbedBuilder().setColor(0xf47fff).setAuthor({ name: `${navnPaa(g)} · Boosts` }).setTitle('💜 Tak til alle der booster!').setDescription(linjer.join('\n'));
  if (g.iconURL()) e.setThumbnail(g.iconURL({ size: 256 }));
  for (const t of BOOST_TRIN) e.addFields({ name: `${n >= t.n ? '✅' : '🔒'} ${flertal(t.n)} · ${t.titel}`, value: [...(t.discord.length ? [`**Discord:** ${t.discord.join(' · ')}`] : []), ...(t.os.length ? [`**Hos os:** ${t.os.join(' · ')}`] : [])].join('\n').slice(0, 1024) || '–' });
  const boostere = g.members.cache.filter(m => m.premiumSince && !m.user.bot).map(m => `<@${m.id}>`);
  if (boostere.length) e.addFields({ name: `💜 Boosters (${boostere.length})`, value: boostere.slice(0, 30).join(' ').slice(0, 1024) });
  e.setFooter({ text: 'Opdateres automatisk. Hver gang nogen booster, skrives det herunder.' });
  await sendEllerRet(k, { embeds: [e] });
}
async function boostOpnaaet(g, d) {
  d.boost = d.boost || { farver: {} };
  const n = g.premiumSubscriptionCount || 0;
  if (!Array.isArray(d.boost.opnaaet)) { d.boost.opnaaet = BOOST_TRIN.filter(t => t.n <= n).map(t => t.n); gem(); return; }
  d.boost.opnaaet = d.boost.opnaaet.filter(x => x <= n);
  const k = d.kanaler.boosts && await g.channels.fetch(d.kanaler.boosts).catch(() => null);
  for (const t of BOOST_TRIN.filter(x => x.n <= n && !d.boost.opnaaet.includes(x.n))) {
    d.boost.opnaaet.push(t.n); gem();
    if (k) await k.send({ content: [`🎉 **Vi har nu ${flertalTekst(t.n)}!** (${t.titel})`, ...(t.discord.length ? [`✨ Nyt på Discord: ${t.discord.join(' · ')}`] : []), ...(t.os.length ? [`🎁 Nyt hos os: ${t.os.join(' · ')}`] : [])].join('\n'), allowedMentions: { parse: [] } }).catch(() => {});
  }
  gem();
}
const flertalTekst = x => `${x} boost${x === 1 ? '' : 's'}`;

// ---------- EMOJIS (udvalgt fra emoji.gg) ----------
const EMOJI_CDN = 'https://cdn3.emoji.gg/emojis/';
const SHOP_EMOJIS = [
  ['ged', '888807-goat.gif'], ['ged100', '638259-100goat.png'], ['gedpixel', '605187-goat.png'], ['gedregnbue', '88964-rainbowgoat.gif'],
  ['penge', '786534-money.png'], ['betaling', '906018-cashmoney.png'], ['flyvendepenge', '471108-flyingmoney.png'], ['guld', '346055-goldbag2.png'],
  ['ja', '491612-checkmark.gif'], ['nej', '746487-crossmark.gif'], ['verificeret', '717729-verified.png'], ['loading', '308215-loading.gif'],
  ['lavticket', '846359-makeaticket.png'], ['ticket', '543756-ticket.png'], ['glimmer', '148047-sparklesstarsunsolarglitter.gif'],
  ['shop', '624357-shoppingbag.png'], ['kurv', '557538-shoppingcart.png'], ['hjerte', '288750-heart.png'], ['pil', '25888-yellow-arrow.gif'],
  ['krone', '489045-crown.png'], ['nyt', '25287-new.gif'], ['booster', '424936-serverbooster.png'], ['diamant', '626030-booster.png'],
  ['vink', '825758-wave.png'], ['klokke', '998082-alert.png'], ['megafon', '222091-megaphone.png'], ['advarsel', '209331-warning.gif'],
];
async function opretEmojis(g, d) {
  if (d.type !== 'shop' || d.emojisV === 1) return;
  const findes = await g.emojis.fetch().catch(() => g.emojis.cache);
  const ud = { ok: 0, fejl: [] };
  for (const [navn, fil] of SHOP_EMOJIS) {
    if (findes.some(e => e.name === navn)) continue;
    await g.emojis.create({ attachment: EMOJI_CDN + fil, name: navn, reason: 'Server-emojis' }).then(() => ud.ok++).catch(e => ud.fejl.push(`${navn}: ${e.message}`));
  }
  spor(`emojis ${g.name}: ${ud.ok} oprettet. ${ud.fejl.join(' | ')}`);
  if (!ud.fejl.length) { d.emojisV = 1; gem(); }
  await log(g, '😀 Emojis tilføjet', [`${ud.ok} nye emojis er lagt op.`, ...(ud.fejl.length ? ['', `⚠️ ${ud.fejl.length} kunne ikke laves (fx for store billeder). Det prøves igen ved næste genstart.`] : [])], ud.fejl.length ? 0xf59e0b : 0x22c55e);
}

// ---------- FORSLAG (som på HopDop HCF) ----------
const forslagCd = new Map();
const lavSid = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const datoTekst = () => new Date().toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'long', year: 'numeric' });

// ---------- ANMELDELSER ----------
const stjerner = n => '⭐'.repeat(n) + '☆'.repeat(5 - n);
function anmSnit(d) {
  const a = Object.values(d.anmeldelser || {});
  return a.length ? { snit: a.reduce((x, y) => x + y.stjerner, 0) / a.length, antal: a.length } : { snit: 0, antal: 0 };
}
const komma = x => x.toFixed(1).replace('.', ',');
async function opdaterAnmPanel(g, d) {
  const k = d.kanaler.anmeldelser && await g.channels.fetch(d.kanaler.anmeldelser).catch(() => null); if (!k) return;
  const { snit, antal } = anmSnit(d);
  await sendEllerRet(k, { embeds: [new EmbedBuilder().setColor(0xfacc15).setAuthor({ name: navnPaa(g) }).setTitle('⭐ Anmeldelser')
    .setDescription([
      antal ? `## ${stjerner(Math.round(snit))}  ${komma(snit)} / 5` : '## Ingen anmeldelser endnu',
      antal ? `Baseret på **${antal}** anmeldelse${antal === 1 ? '' : 'r'} fra verificerede kunder.` : 'Bliv den første til at anmelde et produkt!', '',
      '**Sådan skriver du en anmeldelse:**',
      `**1.** Gå ind i ${d.kanaler.botkmd ? `<#${d.kanaler.botkmd}>` : '#bot-kommandoer'} og skriv **/anmeld**.`,
      '**2.** Vælg **produkt** og **stjerner**.',
      '**3.** Tryk **Enter**. Skriv ikke noget efter stjernerne!',
      '**4.** Nu åbner en **formular**, hvor du skriver en overskrift og din anmeldelse. Tryk **Indsend**.',
      `Kun kunder (rollen ${d.roller.Kunde ? `<@&${d.roller.Kunde}>` : 'Kunde'}) kan anmelde. Du kan altid rette din anmeldelse ved at anmelde samme produkt igen.`,
    ].join('\n'))] });
}

// ---------- TICKETS ----------
// Skabeloner, der popper op, når man laver en ticket (max 5 felter). [id, spørgsmål, lang?, påkrævet?, eksempel]
const MC = ['mc', 'Dit Minecraft-navn', false, true, 'Fx krainer2'];
const TICKET_FORMULAR = {
  'shop:koeb': [['produkt', 'Hvilket produkt vil du købe?', false, true, 'Navnet fra #produkter'],
    ['server', 'Hvilken server/version skal det bruges på?', false, false, 'Fx Prison på 1.8.9'],
    ['betaling', 'Hvordan vil du helst betale?', false, false, 'Fx MobilePay eller PayPal'],
    ['ekstra', 'Spørgsmål eller ønsker?', true, false, 'Skriv hvis du har spørgsmål til produktet']],
  'shop:bestil': [['hvad', 'Hvad skal scriptet/pluginet kunne?', true, true, 'Beskriv så præcist som muligt, gerne punkt for punkt'],
    ['server', 'Servertype og version', false, true, 'Fx KitPvP på 1.8.9 med Skript'],
    ['budget', 'Hvad er dit budget?', false, false, 'Fx 100-200 kr.'],
    ['deadline', 'Hvornår skal det være færdigt?', false, false, 'Fx inden for 2 uger'],
    ['eksempel', 'Eksempler eller andet vi skal vide?', true, false, 'Links, billeder eller servere med noget lignende']],
  'shop:support': [['produkt', 'Hvilket produkt drejer det sig om?', false, true, 'Navnet fra #produkter'],
    ['problem', 'Hvad er problemet?', true, true, 'Hvad sker der, og hvad burde der ske?'],
    ['server', 'Server-version og andre plugins', false, false, 'Fx Paper 1.8.9, Skript 2.6, LuckPerms'],
    ['fejl', 'Fejlbeskeder fra konsollen', true, false, 'Kopiér fejlen ind her, hvis der er en']],
  partner: [['navn', 'Hvad hedder jeres server/projekt?', false, true, ''],
    ['link', 'Permanent invite-link', false, true, 'https://discord.gg/...'],
    ['medlemmer', 'Hvor mange medlemmer har I?', false, true, 'Fx 250'],
    ['om', 'Fortæl kort om jer', true, true, 'Hvad laver I, og hvordan kan vi hjælpe hinanden?']],
  support: [MC, ['problem', 'Hvad drejer det sig om?', true, true, 'Beskriv din sag så godt du kan']],
  anmeld: [MC, ['hvem', 'Hvem anmelder du?', false, true, 'Minecraft-navn eller Discord-navn'],
    ['hvad', 'Hvad skete der?', true, true, 'Hvornår, hvor og hvad'], ['bevis', 'Beviser (links til billeder/video)', true, false, 'Fx YouTube- eller Imgur-links']],
  ansog: [MC, ['hvorfor', 'Hvorfor vil du gerne være med?', true, true, ''], ['erfaring', 'Hvilken erfaring har du?', true, true, 'Fx staff på andre servere'],
    ['tid', 'Hvor meget tid kan du være aktiv?', false, true, 'Fx 2 timer om dagen']],
};
TICKET_FORMULAR.vagt = TICKET_FORMULAR.host = TICKET_FORMULAR.ansog;
const formularFor = (type, slags) => TICKET_FORMULAR[`${type}:${slags}`] || TICKET_FORMULAR[slags];
function ticketModal(type, slags, titel) {
  const felter = formularFor(type, slags); if (!felter) return null;
  return new ModalBuilder().setCustomId(`nv_tkm_${slags}`).setTitle(titel.slice(0, 45)).addComponents(...felter.slice(0, 5).map(([id, label, lang, krav, eks]) =>
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(lang ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(krav).setMaxLength(lang ? 1000 : 200).setPlaceholder((eks || '').slice(0, 100) || ' '))));
}

async function aabnTicket(i, slags, svarFelter = null) {
  const g = i.guild, d = info(g);
  const valg = TICKETS[d.type].find(x => x[0] === slags);
  if (!valg) return svar(i, '❌ Ukendt ticket-type.');
  const aaben = g.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
  if (aaben) return svar(i, `Du har allerede en åben ticket: ${aaben}`);
  if (!i.deferred && !i.replied) await i.deferReply({ flags: MessageFlags.Ephemeral });
  const kat = d.kanaler.kat_support && await g.channels.fetch(d.kanaler.kat_support).catch(() => null);
  const staff = STAFF_ROLLER.map(r => d.roller[r]).filter(Boolean);
  const kanal = await g.channels.create({
    name: `${slags}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9æøå-]/g, '').slice(0, 90) || `ticket-${i.user.id}`,
    type: ChannelType.GuildText, parent: kat?.id, topic: `ticket:${i.user.id}`,
    permissionOverwrites: [
      { id: g.roles.everyone.id, deny: [P.ViewChannel] },
      { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
      ...staff.map(s => TOP_ROLLER.some(r => d.roller[r] === s)
        ? { id: s, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] }
        : { id: s, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles], deny: [P.ManageMessages, P.ManageChannels, P.ManageThreads] }),
    ],
  });
  await kanal.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setColor(farve(g)).setAuthor({ name: navnPaa(g) })
    .setTitle(`${valg[2]} ${valg[1]}`)
    .setDescription(svarFelter?.length ? 'Tak for din ticket! 🙌 Dine svar fra skabelonen står herunder. Staff svarer så hurtigt som muligt. Skriv gerne mere her, eller send billeder.' : (d.type === 'shop' ? 'Tak for din ticket! Skriv hvilket script du er interesseret i, eller hvad du har brug for, så svarer vi hurtigst muligt.' : 'Tak for din ticket! Skriv så meget som muligt om din sag, så svarer staff hurtigst muligt.\nSkriv også dit **Minecraft-navn**.'))],
    components: [new ActionRowBuilder().addComponents(
      ...(d.type === 'shop' && ['koeb', 'bestil'].includes(slags) ? [new ButtonBuilder().setCustomId('nv_kunde').setLabel('Køb gennemført (staff)').setEmoji('✅').setStyle(ButtonStyle.Success)] : []),
      new ButtonBuilder().setCustomId('nv_luk').setLabel('Luk ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger))] });
  if (svarFelter?.length) await kanal.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📋 Udfyldt skabelon')
    .setAuthor({ name: i.member.displayName, iconURL: i.user.displayAvatarURL() })
    .addFields(svarFelter.filter(([, v]) => v).map(([n, v]) => ({ name: n.slice(0, 256), value: v.slice(0, 1024) })))] });
  return i.editReply(`✅ Din ticket er oprettet: ${kanal}`);
}

async function lukTicket(i) {
  const g = i.guild, d = info(g), kanal = i.channel;
  const ejer = String(kanal.topic || '').replace('ticket:', '');
  if (!String(kanal.topic || '').startsWith('ticket:')) return svar(i, '❌ Det her er ikke en ticket.');
  if (ejer !== i.user.id && !erTop(i.member, d)) return svar(i, '❌ Kun den, der lavede ticketen, Ejer eller Admin kan lukke den.');
  await i.reply({ content: '🔒 Ticketen gemmes og lukkes om et øjeblik ...' });
  const arkiv = await gemSamtale(g, d, kanal, ejer, i.user).catch(e => { spor(`ticket-arkiv: ${e.message}`); return null; });
  const knap = arkiv ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Se samtalen').setEmoji('📜').setStyle(ButtonStyle.Link).setURL(arkiv.url))] : [];
  const logK = d.kanaler.ticketlog && await g.channels.fetch(d.kanaler.ticketlog).catch(() => null);
  if (logK) await logK.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📁 Ticket lukket')
    .setDescription([`**Ticket:** ${kanal.name}`, `**Lavet af:** <@${ejer}>`, `**Lukket af:** ${i.user}`, arkiv ? `**Beskeder:** ${arkiv.antal}` : '⚠️ Samtalen kunne ikke gemmes.'].join('\n')).setTimestamp()],
    components: knap, allowedMentions: { parse: [] } }).catch(() => {});
  const u = await i.client.users.fetch(ejer).catch(() => null);
  if (u && arkiv) await u.send({ embeds: [new EmbedBuilder().setColor(farve(g)).setAuthor({ name: navnPaa(g) }).setTitle('📁 Din ticket er lukket')
    .setDescription(`Tak for din henvendelse! Din ticket **${kanal.name}** er lukket af ${i.user.username}.\nDu kan altid læse samtalen igen her. Kun dig og staff kan åbne den.`)], components: knap }).catch(() => {});
  setTimeout(() => kanal.delete('Ticket lukket').catch(() => {}), 5000);
}

// Gemmer hele ticket-samtalen i en PRIVAT tråd i #ticket-arkiv. Kun de medvirkende (og staff) kan åbne den.
async function gemSamtale(g, d, kanal, ejerId, lukketAf) {
  const arkivK = d.kanaler.ticketarkiv && await g.channels.fetch(d.kanaler.ticketarkiv).catch(() => null);
  if (!arkivK) return null;
  let alle = [], foer;
  for (let n = 0; n < 10; n++) { // op til 1000 beskeder
    const bunke = await kanal.messages.fetch({ limit: 100, before: foer }).catch(() => null);
    if (!bunke?.size) break;
    alle.push(...bunke.values()); foer = bunke.last().id;
    if (bunke.size < 100) break;
  }
  alle = alle.reverse();
  const tid = t => new Date(t).toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const traad = await arkivK.threads.create({ name: `📁 ${kanal.name}`.slice(0, 100), type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 10080, reason: 'Ticket-samtale' });
  await traad.send({ embeds: [new EmbedBuilder().setColor(farve(g)).setTitle(`📁 ${kanal.name}`)
    .setDescription([`**Lavet af:** <@${ejerId}>`, `**Lukket af:** ${lukketAf}`, `**Åbnet:** <t:${Math.floor(kanal.createdTimestamp / 1000)}:f>`, `**Lukket:** <t:${Math.floor(Date.now() / 1000)}:f>`, `**Beskeder:** ${alle.length}`].join('\n'))], allowedMentions: { parse: [] } });
  // Beskederne samles i pæne blokke (max 4000 tegn pr. blok)
  const linjer = alle.map(m => {
    const navn = m.member?.displayName || m.author.username;
    const dele = [m.cleanContent, ...m.embeds.map(e => [e.title && `**${e.title}**`, e.description, ...(e.fields || []).map(f => `**${f.name}:** ${f.value}`)].filter(Boolean).join('\n')), ...[...m.attachments.values()].map(x => `📎 [${x.name}](${x.url})`)].filter(Boolean).join('\n');
    return `**${navn}**${m.author.bot ? ' 🤖' : ''} · ${tid(m.createdTimestamp)}\n${dele || '*(tom besked)*'}`;
  });
  let blok = '', blokke = [];
  for (const l of linjer) { const x = l.slice(0, 3900); if ((blok + '\n\n' + x).length > 3900) { blokke.push(blok); blok = x; } else blok = blok ? `${blok}\n\n${x}` : x; }
  if (blok) blokke.push(blok);
  for (let j = 0; j < blokke.length; j += 5) await traad.send({ embeds: blokke.slice(j, j + 5).map(t => new EmbedBuilder().setColor(0x2b2d31).setDescription(t)), allowedMentions: { parse: [] } }).catch(() => {});
  // Tilføj de medvirkende (ejeren + alle der skrev)
  const medvirkende = new Set([ejerId, ...alle.filter(m => !m.author.bot).map(m => m.author.id)]);
  for (const id of medvirkende) await traad.members.add(id).catch(() => {});
  await traad.setLocked(true).catch(() => {});
  await traad.setArchived(true).catch(() => {});
  return { url: traad.url, antal: alle.length };
}

// ---------- KOMMANDOER ----------
const lavKommandoer = typer => [
  ...(typer.includes('shop') ? [new SlashCommandBuilder().setName('boosterfarve').setDescription('Kun for boosters: vælg din egen rollefarve')
    .addStringOption(o => o.setName('farve').setDescription('Hex-farve, fx ff66cc').setRequired(true).setMinLength(6).setMaxLength(7))] : []),
  new SlashCommandBuilder().setName('setup').setDescription('Sæt serveren op med kanaler, roller, regler og tickets (kun admin)')
    .setDefaultMemberPermissions(P.Administrator)
    .addStringOption(o => o.setName('type').setDescription('Hvilken slags server?').setRequired(true)
      .addChoices(...typer.map(value => ({ name: `${TYPER[value].emoji} ${TYPER[value].navn}`, value }))))
    .addStringOption(o => o.setName('navn').setDescription('Navnet der vises i bottens beskeder, fx "Gederne Shop" (tom = servernavnet)').setMaxLength(40)),
  new SlashCommandBuilder().setName('indstil').setDescription('Skift indstillinger for serveren (kun admin)')
    .setDefaultMemberPermissions(P.Administrator)
    .addStringOption(o => o.setName('ip').setDescription('Minecraft-serverens IP (skriv "ingen" for at fjerne den)').setMaxLength(80))
    .addStringOption(o => o.setName('navn').setDescription('Navnet der vises i bottens beskeder').setMaxLength(40)),
  new SlashCommandBuilder().setName('grafik').setDescription('Sæt logo og banner på serveren og på botten (kun admin)')
    .setDefaultMemberPermissions(P.Administrator)
    .addAttachmentOption(o => o.setName('logo').setDescription('Logo (firkantet billede): serverikon og bottens profilbillede'))
    .addAttachmentOption(o => o.setName('banner').setDescription('Banner (bredt billede): bottens profilbanner og serverbanner')),
  new SlashCommandBuilder().setName('forslag').setDescription('Send et forslag til serveren'),
  new SlashCommandBuilder().setName('godkend').setDescription('Godkend et forslag (staff)').setDefaultMemberPermissions(P.ManageMessages)
    .addStringOption(o => o.setName('sid').setDescription('Forslagets sID (står i bunden af forslaget)').setRequired(true).setMaxLength(10))
    .addStringOption(o => o.setName('svar').setDescription('Begrundelse (valgfri)').setMaxLength(500)),
  new SlashCommandBuilder().setName('afvis').setDescription('Afvis et forslag (staff)').setDefaultMemberPermissions(P.ManageMessages)
    .addStringOption(o => o.setName('sid').setDescription('Forslagets sID (står i bunden af forslaget)').setRequired(true).setMaxLength(10))
    .addStringOption(o => o.setName('svar').setDescription('Begrundelse (valgfri)').setMaxLength(500)),
  ...(typer.includes('shop') ? [new SlashCommandBuilder().setName('anmeld').setDescription('Vælg produkt og stjerner, tryk Enter. Så åbner en formular, hvor du skriver din anmeldelse')
    .addStringOption(o => o.setName('produkt').setDescription('Trin 1: Hvilket produkt har du købt?').setRequired(true).setMaxLength(80).setAutocomplete(true))
    .addIntegerOption(o => o.setName('stjerner').setDescription('Trin 2: Vælg stjerner og tryk Enter. Teksten skriver du i formularen bagefter').setRequired(true)
      .addChoices({ name: '⭐⭐⭐⭐⭐ Fantastisk', value: 5 }, { name: '⭐⭐⭐⭐ Rigtig godt', value: 4 }, { name: '⭐⭐⭐ Godt', value: 3 }, { name: '⭐⭐ Okay', value: 2 }, { name: '⭐ Dårligt', value: 1 })),
    new SlashCommandBuilder().setName('fjernanmeldelse').setDescription('Fjern en anmeldelse (staff kan fjerne alle, kunder deres egne)')
      .addStringOption(o => o.setName('anmeldelse').setDescription('Vælg anmeldelsen på listen').setRequired(true).setAutocomplete(true))] : []),
  new SlashCommandBuilder().setName('invite').setDescription('Få invite-linket til serveren, så du kan invitere dine venner'),
  new SlashCommandBuilder().setName('ip').setDescription('Vis serverens IP-adresse'),
  new SlashCommandBuilder().setName('say').setDescription('Lad botten skrive en besked (kun staff)')
    .setDefaultMemberPermissions(P.ManageMessages)
    .addStringOption(o => o.setName('tekst').setDescription('Hvad skal botten skrive?').setRequired(true).setMaxLength(2000)),
].map(c => c.toJSON());

// Starter netværks-funktionerne på en bot. typer = hvilke servertyper /setup tilbyder på den bot.
function start(client, onAlle, HOVED_ID, typer) {
  const kommandoer = lavKommandoer(typer);
  const andre = () => [...client.guilds.cache.values()].filter(g => g.id !== HOVED_ID);
  const registrer = g => g.commands.set(kommandoer)
    .then(() => console.log(`Netværk: kommandoer sat på ${g.name}`))
    .catch(e => console.error(`Netværk: kunne ikke sætte kommandoer på ${g.name}:`, e.message));

  onAlle('clientReady', async () => {
    spor(`klar: ${client.user?.tag} med ${andre().length} servere`);
    await findInvites(client);
    setTimeout(() => postOpslag(client).catch(e => spor(`opslag: ${e.message}`)), 50000).unref?.();
    const stats = () => { for (const g of andre()) opdaterStats(g, info(g)).catch(e => spor(`stats: ${e.message}`)); };
    setTimeout(stats, 60000).unref?.(); setInterval(stats, 10 * 60000).unref?.();
    setTimeout(async () => { for (const g of andre()) { const d = info(g); if (!d?.sat) continue;
      await synkBoostere(g, d).catch(e => spor(`boost: ${e.message}`)); await boostOpnaaet(g, d).catch(() => {}); await opdaterBoosts(g, d).catch(e => spor(`boosts: ${e.message}`));
      await opretEmojis(g, d).catch(e => spor(`emojis: ${e.message}`)); } }, 30000).unref?.();
    for (const g of andre()) {
      await registrer(g);
      spor(`kommandoer ok ${g.name}`);
      // Ny skabelon (fx forummer, rettigheder): opdatér servere, der allerede er sat op
      const d = info(g);
      if (d?.type && d.sat && d.skabelonV !== SKABELON_V) {
        const rapport = await byg(g, d, d.type).catch(e => [e.message]);
        await postPaneler(g, d).catch(() => {});
        console.log(`Netværk: ${g.name} er opdateret til skabelon ${SKABELON_V}.${rapport.length ? ' Problemer: ' + rapport.join(' | ') : ''}`);
        await log(g, '🔄 Botten har opdateret serveren', ['Kanaler, rettigheder, roller og opsætning er bragt op til den nyeste version.', '', ...rapportLinjer(rapport)], rapport.length ? 0xf59e0b : 0x22c55e);
      }
    }
  });
  // Ping-lås (som på HopDop HCF): kun staff må pinge @everyone, @here og roller
  onAlle('messageCreate', async m => {
    try {
      if (!m.guild || m.guild.id === HOVED_ID || m.author.bot || m.webhookId || m.system || !m.member) return;
      const d = info(m.guild); if (!d) return;
      if (!m.mentions.everyone && !m.mentions.roles.size) return;
      if (erStaff(m.member, d)) return;
      await m.delete().catch(() => {});
      const w = await m.channel.send({ content: `${m.author}, du kan ikke tagge roller eller alle. Tag en enkelt person i stedet. 🚫`, allowedMentions: { users: [m.author.id] } }).catch(() => null);
      if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
    } catch (e) { console.error('Ping-lås:', e.message); }
  });
  onAlle('guildCreate', g => { if (g.id !== HOVED_ID) { console.log(`Netværk: botten er tilføjet til ${g.name}`); registrer(g); } });

  const erForum = (g, id) => { const d = info(g); return d && [d.kanaler.produkter, d.kanaler.showcase].includes(id); };
  onAlle('threadCreate', t => { if (t.guild && t.guild.id !== HOVED_ID && erForum(t.guild, t.parentId)) statsSnart(t.guild); });
  onAlle('threadDelete', t => { if (t.guild && t.guild.id !== HOVED_ID && erForum(t.guild, t.parentId)) statsSnart(t.guild); });
  onAlle('guildMemberUpdate', (gl, ny) => {
    if (ny.guild.id === HOVED_ID) return;
    const d = info(ny.guild); if (!d) return;
    if (['Kunde', 'Vagt'].some(r => d.roller[r] && gl.roles.cache.has(d.roller[r]) !== ny.roles.cache.has(d.roller[r]))) statsSnart(ny.guild);
  });
  onAlle('guildMemberAdd', m => { if (m.guild.id !== HOVED_ID && info(m.guild)) statsSnart(m.guild); });
  // Boosts: rolle, #boosts og besked når nogen booster
  onAlle('guildMemberUpdate', async (gl, ny) => {
    if (ny.guild.id === HOVED_ID || !!gl.premiumSince === !!ny.premiumSince) return;
    const d = info(ny.guild); if (!d) return;
    await synkBoostere(ny.guild, d).catch(() => {}); await opdaterBoosts(ny.guild, d).catch(() => {});
  });
  onAlle('guildUpdate', async (gl, ny) => {
    if (ny.id === HOVED_ID || gl.premiumSubscriptionCount === ny.premiumSubscriptionCount) return;
    const d = info(ny); if (!d) return;
    await boostOpnaaet(ny, d).catch(() => {}); await opdaterBoosts(ny, d).catch(() => {});
  });
  onAlle('messageCreate', async m => {
    if (!m.guild || m.guild.id === HOVED_ID || ![8, 9, 10, 11].includes(m.type)) return;
    const d = info(m.guild); const k = d?.kanaler?.boosts && await m.guild.channels.fetch(d.kanaler.boosts).catch(() => null); if (!k) return;
    const niv = { 9: 1, 10: 2, 11: 3 }[m.type];
    await k.send({ content: `🔮 ${m.author} har lige boosted serveren! Tusind tak! 💜${niv ? ` Vi er nu på **niveau ${niv}**! 🎉` : ''}`, allowedMentions: { parse: [] } }).catch(() => {});
  });
  onAlle('threadCreate', async (t, ny) => {
    if (!ny || !t.guild || t.guild.id === HOVED_ID) return;
    const d = info(t.guild); if (!d?.kanaler?.reklame || t.parentId !== d.kanaler.reklame) return;
    await tjekReklame(t, d).catch(e => spor(`reklame-tjek: ${e.message}`));
  });
  // #hjælp-hinanden: skriver man direkte i kanalen, laver botten en tråd ud fra beskeden
  onAlle('messageCreate', async m => {
    try {
      if (!m.guild || m.guild.id === HOVED_ID || m.author.bot || m.webhookId || m.system) return;
      const d = info(m.guild); if (!d?.kanaler?.hjaelp || m.channelId !== d.kanaler.hjaelp || m.hasThread) return;
      const navn = (m.content || '').replace(/<[@#&!:a-z0-9]+>/gi, '').replace(/\s+/g, ' ').trim().slice(0, 80) || `Hjælp til ${m.member?.displayName || m.author.username}`;
      const t = await m.startThread({ name: navn, autoArchiveDuration: 1440 }).catch(e => { spor(`hjaelp-tråd: ${e.message}`); return null; });
      if (t) await t.send({ content: `👋 ${m.author}, jeg har lavet en tråd til dit spørgsmål. Skriv videre herinde: her er **ingen cooldown**, og du kan tagge folk og sende billeder. 🧵` }).catch(() => {});
    } catch (e) { spor(`hjaelp: ${e.message}`); }
  });
  onAlle('guildMemberRemove', m => { if (m.guild.id !== HOVED_ID && info(m.guild)) statsSnart(m.guild); });
  onAlle('guildMemberUpdate', async (gl, ny) => {
    if (ny.guild.id === HOVED_ID || !gl.pending || ny.pending) return;
    const d = info(ny.guild); if (!d?.roller?.Spiller || ny.roles.cache.has(d.roller.Spiller)) return;
    await ny.roles.add(d.roller.Spiller, 'Accepterede reglerne').catch(e => console.error('Auto-Spiller:', e.message));
  });
  onAlle('guildMemberAdd', async m => {
    if (m.guild.id === HOVED_ID) return;
    const d = info(m.guild); if (!d?.kanaler?.velkommen) return;
    const k = await m.guild.channels.fetch(d.kanaler.velkommen).catch(() => null);
    if (k) k.send({ content: `${m}`, embeds: [new EmbedBuilder().setColor(farve(m.guild))
      .setTitle(`👋 Velkommen til ${navnPaa(m.guild)}!`)
      .setDescription(`Hej ${m}, godt at have dig her!\nLæs <#${d.kanaler.regler}>, og tryk på knappen for at få adgang.\nDu er medlem nr. **${m.guild.memberCount}**.`)
      .setThumbnail(m.user.displayAvatarURL())] }).catch(() => {});
  });

  onAlle('interactionCreate', async i => {
    if (!i.guild || i.guild.id === HOVED_ID) return;
    if (i.isModalSubmit()) spor(`modal ${i.customId} fra ${i.user.tag} på ${i.guild.name}`);
    try {
      const d = info(i.guild);
      // Forslag på produkter: navne fra #produkter-forummet
      if (i.isAutocomplete() && i.commandName === 'fjernanmeldelse') {
        const staff = d && erStaff(i.member, d), s = i.options.getFocused().toLowerCase();
        const liste = Object.entries(d?.anmeldelser || {}).filter(([, a]) => staff || a.user === i.user.id);
        const valg = [];
        for (const [noegle, a] of liste) {
          const m = i.guild.members.cache.get(a.user);
          const navn = `${a.produkt} · ${'⭐'.repeat(a.stjerner)} · ${m?.displayName || 'ukendt'}`;
          if (navn.toLowerCase().includes(s)) valg.push({ name: navn.slice(0, 100), value: noegle.slice(0, 100) });
        }
        return i.respond(valg.slice(0, 25)).catch(() => {});
      }
      if (i.isAutocomplete() && i.commandName === 'anmeld') {
        const f = d?.kanaler.produkter && await i.guild.channels.fetch(d.kanaler.produkter).catch(() => null);
        const navne = f?.threads ? [...(await f.threads.fetchActive().catch(() => null))?.threads.filter(t => t.parentId === f.id).values() || [], ...(await f.threads.fetchArchived({ limit: 50 }).catch(() => null))?.threads.values() || []].map(t => t.name) : [];
        const s = i.options.getFocused().toLowerCase();
        return i.respond([...new Set(navne)].filter(n => n.toLowerCase().includes(s)).slice(0, 25).map(n => ({ name: n.slice(0, 100), value: n.slice(0, 80) }))).catch(() => {});
      }
      if (i.isModalSubmit() && i.customId.startsWith('nv_tkm_')) {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const slags = i.customId.slice(7);
        const felter = (formularFor(d.type, slags) || []).map(([id, label]) => { let v = ''; try { v = i.fields.getTextInputValue(id).trim(); } catch { v = ''; } return [label, v]; });
        return aabnTicket(i, slags, felter);
      }
      if (i.isModalSubmit() && i.customId === 'nv_forslag') {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const tekst = i.fields.getTextInputValue('tekst').trim(), emne = i.fields.getTextInputValue('emne').trim();
        const k = d?.kanaler.forslag && await i.guild.channels.fetch(d.kanaler.forslag).catch(() => null);
        if (!k) return svar(i, '❌ Forslagskanalen findes ikke.');
        const sid = lavSid();
        const msg = await k.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(`💡 ${emne || 'Nyt forslag'}`)
          .setAuthor({ name: i.member.displayName, iconURL: i.user.displayAvatarURL() }).setDescription(tekst.slice(0, 2000))
          .setFooter({ text: `sID: ${sid} • ${datoTekst()}` })] });
        await msg.react('✅').catch(() => {}); await msg.react('❌').catch(() => {});
        d.forslag = d.forslag || {}; d.forslag[sid] = { msg: msg.id, user: i.user.id, tekst: tekst.slice(0, 300) }; gem();
        forslagCd.set(i.user.id, Date.now());
        return svar(i, `✅ Dit forslag er sendt til ${k}. (sID: \`${sid}\`)`);
      }
      if (i.isModalSubmit() && i.customId.startsWith('nv_anm:')) {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const [, n, ...rest] = i.customId.split(':'); const produkt = rest.join(':'), st = Math.max(1, Math.min(5, parseInt(n, 10) || 5));
        const tekst = i.fields.getTextInputValue('tekst').trim();
        let titel = ''; try { titel = i.fields.getTextInputValue('titel').trim(); } catch { titel = ''; }
        const k = d?.kanaler.anmeldelser && await i.guild.channels.fetch(d.kanaler.anmeldelser).catch(() => null);
        if (!k) return svar(i, '❌ Anmeldelses-kanalen findes ikke.');
        d.anmeldelser = d.anmeldelser || {};
        const noegle = `${i.user.id}:${produkt.toLowerCase()}`;
        const farver = { 5: 0x22c55e, 4: 0x84cc16, 3: 0xfacc15, 2: 0xf97316, 1: 0xef4444 };
        const emb = new EmbedBuilder().setColor(farver[st]).setAuthor({ name: `${i.member.displayName} · ✔ Verificeret kunde`, iconURL: i.user.displayAvatarURL() })
          .setTitle(titel ? `“${titel}”`.slice(0, 256) : `${stjerner(st)}  ${st}/5`)
          .setDescription(`${titel ? `**${stjerner(st)}  ${st}/5**\n\n` : ''}>>> ${tekst.slice(0, 1500)}`)
          .addFields({ name: '📦 Produkt', value: produkt.slice(0, 100), inline: true }, { name: '🗓️ Dato', value: datoTekst(), inline: true })
          .setThumbnail(i.user.displayAvatarURL({ size: 128 }));
        const gl = d.anmeldelser[noegle];
        let msg = gl && await k.messages.fetch(gl.msg).catch(() => null);
        if (msg) await msg.edit({ embeds: [emb.setFooter({ text: 'Rettet' })] }); else msg = await k.send({ embeds: [emb] });
        d.anmeldelser[noegle] = { msg: msg.id, user: i.user.id, produkt, stjerner: st }; gem();
        await opdaterAnmPanel(i.guild, d); statsSnart(i.guild);
        await log(i.guild, '⭐ Ny anmeldelse', [`${i.user} gav **${produkt}** ${stjerner(st)} (${st}/5).`], farver[st]);
        return svar(i, `✅ Tak for din anmeldelse! Den står nu i ${k}.`);
      }
      if (i.isChatInputCommand()) {
        // Offentlige kommandoer må kun bruges i #bot-kommandoer (staff må overalt), som på HopDop HCF
        const OFFENTLIGE = ['ip', 'invite', 'forslag', 'anmeld', 'fjernanmeldelse', 'boosterfarve'];
        if (d?.kanaler.botkmd && OFFENTLIGE.includes(i.commandName) && i.channelId !== d.kanaler.botkmd && !erStaff(i.member, d))
          return svar(i, `Brug kommandoer i <#${d.kanaler.botkmd}> 🙂`);
        if (i.commandName === 'setup') {
          if (!i.member.permissions.has(P.Administrator)) return svar(i, '❌ Kun admins kan bruge /setup.');
          const mig = i.guild.members.me;
          if (!mig.permissions.has(P.Administrator) && !(mig.permissions.has(P.ManageChannels) && mig.permissions.has(P.ManageRoles)))
            return svar(i, '❌ Botten mangler rettighederne **Administrer kanaler** og **Administrer roller**. Giv botten dem, og prøv igen.');
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          return setup(i, i.options.getString('type'), i.options.getString('navn'));
        }
        if (i.commandName === 'indstil') {
          if (!d) return svar(i, '❌ Kør `/setup` først.');
          const ip = i.options.getString('ip'), navn = i.options.getString('navn');
          if (!ip && !navn) return svar(i, 'Skriv mindst én ting, du vil ændre, fx `/indstil ip:play.dinserver.dk`.');
          if (ip) d.ip = ip.toLowerCase() === 'ingen' ? '' : ip.trim();
          if (navn) d.navn = navn.trim();
          gem();
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          await opdaterIp(i.guild, d);
          await log(i.guild, '⚙️ Indstillinger ændret', [`Af ${i.user}`, ...(ip ? [`IP: \`${d.ip || 'ingen'}\``] : []), ...(navn ? [`Navn: **${d.navn}**`] : [])]);
          return svar(i, '✅ Gemt!');
        }
        if (i.commandName === 'grafik') {
          if (!i.member.permissions.has(P.Administrator)) return svar(i, '❌ Kun admins kan bruge /grafik.');
          const logo = i.options.getAttachment('logo'), banner = i.options.getAttachment('banner');
          if (!logo && !banner) return svar(i, 'Vedhæft mindst ét billede: `logo` og/eller `banner`.');
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          const hentBillede = async a => Buffer.from(await (await fetch(a.url)).arrayBuffer());
          const ud = [];
          const g = i.guild, bot = i.client.user;
          if (logo) {
            const b = await hentBillede(logo);
            await g.setIcon(b, '/grafik').then(() => ud.push('✅ Serverikon')).catch(e => ud.push(`❌ Serverikon: ${e.message}`));
            await bot.setAvatar(b).then(() => ud.push('✅ Bottens profilbillede')).catch(e => ud.push(`❌ Profilbillede: ${e.message}`));
          }
          if (banner) {
            const b = await hentBillede(banner);
            await bot.setBanner(b).then(() => ud.push('✅ Bottens profilbanner')).catch(e => ud.push(`❌ Profilbanner: ${e.message}`));
            if (g.premiumTier >= 2) await g.setBanner(b, '/grafik').then(() => ud.push('✅ Serverbanner')).catch(e => ud.push(`❌ Serverbanner: ${e.message}`));
            else ud.push('ℹ️ Serverbanner kræver boost-niveau 2. Det sættes ikke endnu.');
            if (g.premiumTier >= 1) await g.setSplash(b, '/grafik').then(() => ud.push('✅ Invite-baggrund')).catch(() => {});
          }
          await log(g, '🖼️ Grafik opdateret', [`Af ${i.user}`, ...ud]);
          return svar(i, ud.join('\n'));
        }
        if (i.commandName === 'boosterfarve') {
          const m = i.member, hex = i.options.getString('farve').replace('#', '').trim();
          if (!m.premiumSince) return svar(i, 'Kun dem, der booster serveren, kan bruge den her. 💜');
          if (!/^[0-9a-f]{6}$/i.test(hex)) return svar(i, 'Skriv en hex-farve med 6 tegn, fx `ff66cc`.');
          await i.deferReply({ flags: MessageFlags.Ephemeral });
          d.boost = d.boost || { farver: {} }; d.boost.farver = d.boost.farver || {};
          let r = d.boost.farver[m.id] && i.guild.roles.cache.get(d.boost.farver[m.id]);
          if (r) await r.setColor(parseInt(hex, 16)).catch(() => {});
          else {
            r = await i.guild.roles.create({ name: `💜 ${m.displayName}`.slice(0, 100), color: parseInt(hex, 16), permissions: [], reason: 'Boosterfarve' }).catch(() => null);
            if (!r) return svar(i, 'Kunne ikke lave rollen.');
            // Farven skal ligge over Skripter/Trusted/Booster, ellers vises den ikke for folk med flere roller
            const top = ['Skripter', 'Trusted', 'Booster'].map(n => d.roller[n] && i.guild.roles.cache.get(d.roller[n])).filter(Boolean).sort((a, b) => b.position - a.position)[0];
            if (top) await r.setPosition(top.position + 1).catch(() => {});
            d.boost.farver[m.id] = r.id; gem();
          }
          await m.roles.add(r).catch(() => {});
          return svar(i, `🎨 Din farve er sat til **#${hex.toLowerCase()}**.`);
        }
        if (i.commandName === 'forslag') {
          if (!d) return svar(i, '❌ Serveren er ikke sat op endnu.');
          const venter = 60000 - (Date.now() - (forslagCd.get(i.user.id) || 0));
          if (venter > 0) return svar(i, `Vent ${Math.ceil(venter / 1000)} sekunder før dit næste forslag.`);
          return i.showModal(new ModalBuilder().setCustomId('nv_forslag').setTitle('Nyt forslag').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emne').setLabel('Kort overskrift').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setPlaceholder('Fx "Flere Prison-scripts"')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tekst').setLabel('Dit forslag').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000))));
        }
        if (i.commandName === 'godkend' || i.commandName === 'afvis') {
          if (!d || !erStaff(i.member, d)) return svar(i, '❌ Kun staff kan svare på forslag.');
          const ok = i.commandName === 'godkend', sid = i.options.getString('sid').trim().toUpperCase(), begr = i.options.getString('svar');
          const f = d.forslag?.[sid]; if (!f) return svar(i, 'Fandt ikke et forslag med det sID.');
          const k = await i.guild.channels.fetch(d.kanaler.forslag).catch(() => null);
          const msg = k && await k.messages.fetch(f.msg).catch(() => null);
          if (!msg) return svar(i, 'Forslagsbeskeden er slettet.');
          await msg.edit({ embeds: [EmbedBuilder.from(msg.embeds[0]).setColor(ok ? 0x22c55e : 0xef4444)
            .setTitle(`${ok ? '✅ Godkendt' : '❌ Afvist'}: ${msg.embeds[0].title.replace(/^💡 /, '').replace(/^(✅ Godkendt|❌ Afvist): /, '')}`.slice(0, 256))
            .setFields({ name: `${ok ? 'Godkendt' : 'Afvist'} af ${i.member.displayName}`, value: begr || 'Ingen begrundelse.' })] });
          f.status = ok ? 'godkendt' : 'afvist'; gem();
          const u = await i.client.users.fetch(f.user).catch(() => null);
          if (u) u.send(`Dit forslag på **${navnPaa(i.guild)}** er blevet **${ok ? 'godkendt ✅' : 'afvist ❌'}**: "${f.tekst.slice(0, 200)}"${begr ? `\nBegrundelse: ${begr}` : ''}`).catch(() => {});
          return svar(i, `Forslag \`${sid}\` er ${ok ? 'godkendt' : 'afvist'}.`);
        }
        if (i.commandName === 'fjernanmeldelse') {
          const noegle = i.options.getString('anmeldelse'), a = d?.anmeldelser?.[noegle];
          if (!a) return svar(i, '❌ Fandt ikke den anmeldelse. Vælg en fra listen, der dukker op.');
          if (a.user !== i.user.id && !erStaff(i.member, d)) return svar(i, '❌ Du kan kun fjerne dine egne anmeldelser.');
          const k = await i.guild.channels.fetch(d.kanaler.anmeldelser).catch(() => null);
          const msg = k && await k.messages.fetch(a.msg).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
          delete d.anmeldelser[noegle]; gem();
          await opdaterAnmPanel(i.guild, d); statsSnart(i.guild);
          await log(i.guild, '🗑️ Anmeldelse fjernet', [`${i.user} fjernede <@${a.user}>'s anmeldelse af **${a.produkt}** (${'⭐'.repeat(a.stjerner)}).`]);
          return svar(i, `🗑️ Anmeldelsen af **${a.produkt}** er fjernet.`);
        }
        if (i.commandName === 'anmeld') {
          if (!d?.roller.Kunde) return svar(i, '❌ Anmeldelser er ikke sat op her.');
          if (!i.member.roles.cache.has(d.roller.Kunde) && !erStaff(i.member, d)) return svar(i, '⭐ Kun kunder kan skrive anmeldelser. Når du har købt noget, får du rollen **Kunde**.');
          const produkt = i.options.getString('produkt').replace(/[\r\n:]+/g, ' ').trim().slice(0, 70), st = i.options.getInteger('stjerner');
          return i.showModal(new ModalBuilder().setCustomId(`nv_anm:${st}:${produkt}`).setTitle(`${'⭐'.repeat(st)} ${produkt}`.slice(0, 45)).addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titel').setLabel('Overskrift (kort)').setStyle(TextInputStyle.Short)
              .setRequired(false).setMaxLength(80).setPlaceholder('Fx "Bedste prison-script jeg har købt!"')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tekst').setLabel('Beskrivelse: hvad synes du om produktet?').setStyle(TextInputStyle.Paragraph)
              .setRequired(true).setMinLength(20).setMaxLength(1500).setPlaceholder('Hvad var godt? Hvad kunne være bedre? Hvordan var hjælpen? Vil du anbefale det?'))));
        }
        if (i.commandName === 'invite') {
          return i.reply({ embeds: [new EmbedBuilder().setColor(farve(i.guild)).setTitle(`📨 Invitér dine venner til ${navnPaa(i.guild)}`)
            .setDescription(d?.invite ? `Del dette link:\n**${d.invite}**` : 'Der er ikke sat et invite-link op endnu.')] });
        }
        if (i.commandName === 'ip') {
          return i.reply({ embeds: [new EmbedBuilder().setColor(farve(i.guild)).setTitle('🌐 Server-IP')
            .setDescription(d?.ip ? `**IP:** \`${d.ip}\`` : '⏳ Serveren er ikke åben endnu.')] });
        }
        if (i.commandName === 'say') {
          if (!d || !erStaff(i.member, d)) return svar(i, '❌ Kun staff kan bruge /say.');
          await i.channel.send({ content: i.options.getString('tekst'), allowedMentions: { parse: [] } });
          await log(i.guild, '💬 /say brugt', [`${i.user} fik botten til at skrive i ${i.channel}.`]);
          return svar(i, '✅ Sendt.');
        }
        return;
      }
      if (i.isButton()) {
        if (!d) return svar(i, '❌ Serveren er ikke sat op endnu.');
        if (i.customId === 'nv_verify') {
          const rolle = d.roller.Spiller;
          if (!rolle) return svar(i, `❌ Rollen ${visNavn(d.type, 'Spiller')} findes ikke. Bed en admin køre /setup igen.`);
          if (i.member.roles.cache.has(rolle)) return svar(i, '✅ Du har allerede adgang!');
          await i.member.roles.add(rolle, 'Accepterede reglerne');
          return svar(i, `✅ Velkommen! Du har nu adgang til ${navnPaa(i.guild)}. Kig i <#${d.kanaler.chat}>.`);
        }
        if (i.customId.startsWith('nv_tk_')) {
          const slags = i.customId.slice(6), valg = TICKETS[d.type]?.find(x => x[0] === slags);
          const aaben = i.guild.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
          if (aaben) return svar(i, `Du har allerede en åben ticket: ${aaben}`);
          const modal = valg && ticketModal(d.type, slags, `${valg[2]} ${valg[1]}`);
          return modal ? i.showModal(modal) : aabnTicket(i, slags);
        }
        if (i.customId === 'nv_luk') return lukTicket(i);
        if (i.customId === 'nv_kunde') {
          if (!erStaff(i.member, d)) return svar(i, '❌ Kun staff kan markere et køb som gennemført.');
          const ejer = String(i.channel?.topic || '').replace('ticket:', '');
          const m = ejer && await i.guild.members.fetch(ejer).catch(() => null);
          if (!m || !d.roller.Kunde) return svar(i, '❌ Kunne ikke finde kunden.');
          if (m.roles.cache.has(d.roller.Kunde)) return svar(i, `✅ ${m} er allerede kunde.`);
          await m.roles.add(d.roller.Kunde, `Køb gennemført (markeret af ${i.user.tag})`);
          await i.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Køb gennemført')
            .setDescription(`Tak for dit køb, ${m}! 🐐\nDu har fået rollen **Kunde** og kan nu skrive en anmeldelse med **/anmeld** i ${d.kanaler.botkmd ? `<#${d.kanaler.botkmd}>` : '#bot-kommandoer'} og få hjælp af andre i ${d.kanaler.hjaelp ? `<#${d.kanaler.hjaelp}>` : '#hjælp-hinanden'}.`)] });
          await log(i.guild, '🛒 Ny kunde', [`${m} fik rollen **Kunde** (markeret af ${i.user}).`], 0x22c55e);
          return statsSnart(i.guild);
        }
      }
    } catch (e) {
      console.error(`Netværk (${i.guild?.name}):`, e); spor(`FEJL i ${i.commandName || i.customId}: ${e.stack?.split('\n').slice(0, 3).join(' | ')}`);
      svar(i, `❌ Noget gik galt: ${e.message}`);
    }
  });
}

// ---------- GEDERNE BUTIK BOT (separat bot) ----------
// Logo og banner (sættes én gang pr. version: serverikon, bottens profilbillede og -banner)
const SHOP_GRAFIK = { v: 5, servernavn: '🐐 | Gederne Shop | 🐐', visningsnavn: 'Gederne Shop',
  logo: 'https://raw.githubusercontent.com/Krainer2/hopdop-discord-bot/b818a5fc22e0fd2c33db05df5dd8ea4081d43c3c/g1.png',
  banner: 'https://raw.githubusercontent.com/Krainer2/hopdop-discord-bot/b818a5fc22e0fd2c33db05df5dd8ea4081d43c3c/g2.jpg' };
async function saetShopGrafik(shop) {
  data._shopbot = data._shopbot || {};
  if (data._shopbot.grafikV === SHOP_GRAFIK.v) return;
  const hent = async u => { const r = await fetch(u); if (!r.ok) throw new Error(`download ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
  // Servernavn (virker også, selv om billederne ikke kan hentes)
  for (const g of shop.guilds.cache.values()) {
    if (g.name !== SHOP_GRAFIK.servernavn) await g.setName(SHOP_GRAFIK.servernavn, 'Servernavn').then(() => spor('servernavn sat')).catch(e => spor(`servernavn: ${e.message}`));
    if (data[g.id] && data[g.id].navn !== SHOP_GRAFIK.visningsnavn) { data[g.id].navn = SHOP_GRAFIK.visningsnavn; gem(); } // navnet i bottens beskeder (uden emoji)
  }
  try {
    const logo = await hent(SHOP_GRAFIK.logo), banner = await hent(SHOP_GRAFIK.banner);
    const ud = [];
    if (!data._shopbot.profilV) {
      await shop.user.setAvatar(logo).then(() => ud.push('profilbillede')).catch(e => ud.push(`profilbillede FEJL ${e.message}`));
      await shop.user.setBanner(banner).then(() => ud.push('profilbanner')).catch(e => ud.push(`profilbanner FEJL ${e.message}`));
    }
    // App-ikon og app-banner i Developer Portal (+ "Om mig")
    await shop.application.edit({ icon: logo, coverImage: banner, description: SHOP_OM_MIG }).then(() => ud.push('app-ikon og app-banner')).catch(e => ud.push(`app-ikon FEJL ${e.message}`));
    for (const g of shop.guilds.cache.values()) {
      await g.setIcon(logo, 'Logo').then(() => ud.push(`ikon ${g.name}`)).catch(e => ud.push(`ikon FEJL ${e.message}`));
      if (g.premiumTier >= 2) await g.setBanner(banner, 'Banner').catch(() => {});
      if (g.premiumTier >= 1) await g.setSplash(banner, 'Banner').catch(() => {});
    }
    spor(`shop-grafik: ${ud.join(', ')}`);
    if (!ud.some(x => x.includes('FEJL'))) { data._shopbot.grafikV = SHOP_GRAFIK.v; data._shopbot.profilV = 1; gem(); }
  } catch (e) { spor(`shop-grafik fejl: ${e.message}`); }
}
const SHOP_WEB = 'https://gederneshop.pages.dev';
const SHOP_OM_MIG = [
  '🐐 Botten bag Gederne Shop',
  'Danske Minecraft-scripts og plugins, lavet med omhu. Køb færdige produkter, se showcases eller bestil dit helt eget custom script.',
  '',
  `🌐 Shop: ${SHOP_WEB}`,
  '📨 Discord: https://discord.gg/EaDhda9TjA',
  '🎫 Køb og support: opret en ticket i #opret-ticket',
].join('\n');
function startShopBot() {
  const { Client, GatewayIntentBits, ActivityType, OAuth2Scopes } = require('discord.js');
  const shop = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
  start(shop, shop.on.bind(shop), null, ['shop']);
  shop.once('clientReady', async () => {
    console.log('Gederne Butik Bot er online som', shop.user.tag);
    await saetShopGrafik(shop);
    const status = () => shop.user.setPresence({ activities: [{ type: ActivityType.Custom, name: 'custom', state: '🌐 Browser rundt på gederneshop.pages.dev' }], status: 'online' });
    status(); setInterval(status, 30 * 60000).unref?.();
    await shop.application.edit({ description: SHOP_OM_MIG }).catch(e => console.error('Shop-bot "Om mig":', e.message));
    console.log('Invitér Gederne Butik Bot:', shop.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions: ['Administrator'] }));
  });
  shop.login(process.env.SHOP_TOKEN).catch(e => console.error('Gederne Butik Bot kunne ikke logge ind:', e.message,
    /intent/i.test(e.message) ? '(slå "Server Members Intent" til under Bot i Developer Portal)' : ''));
  return shop;
}

module.exports = function netvaerk(client, onAlle, HOVED_ID) {
  start(client, onAlle, HOVED_ID, ['prison', 'kitpvp', 'uhc', 'andet']);
  if (process.env.SHOP_TOKEN) startShopBot();
};
// Bruges af testen
module.exports._intern = { data, TYPER, KANALER, ROLLER, TICKETS, lavKommandoer, start };
