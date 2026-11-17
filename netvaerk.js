// (c) 2026 Krainer2 - Alle rettigheder forbeholdt
// NETVÆRK: HOPDOP Bot på de andre HopDop-servere (Prison, KitPvP ...).
// Gederne Butik Bot: en HELT separat bot (eget navn/token: SHOP_TOKEN i .env), der kører fra samme proces.
// Den nævner aldrig HopDop, så butikken ikke kan spores tilbage.
// HopDop selv (GUILD_ID) styres stadig KUN af index.js. Denne fil rører aldrig HopDop-serveren.
// Data for hver server gemmes i servere.json (lokal fil, uploades ikke til GitHub).
const fs = require('fs');
const { ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, MessageFlags, AttachmentBuilder, PermissionsBitField, ChannelFlags } = require('discord.js');

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
  shop: [{ navn: 'Kunde', farve: 0xf59e0b, hoist: true }],
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
      { n: 'botkmd', navn: '🤖┃bot-kommandoer', slow: 5, topic: 'Brug bottens kommandoer her, fx /ip.' },
      { n: 'forslag', navn: '💡┃forslag', slow: 30, topic: 'Har du en idé? Skriv den her. Stem med reaktioner.' },
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
      topic: 'Alle vores produkter. Ét opslag pr. produkt med billeder, pris og beskrivelse. Køb via en ticket i #opret-ticket.' },
    { n: 'showcase', navn: '🎬┃showcase', las: true, reager: true, alle: true, forum: { tags: [['Video', '🎥'], ['Billeder', '🖼️'], ...TAG_FILTRE, ['Custom', '✍️'], ['Opdatering', '🆕']], reaktion: '🔥' },
      topic: 'Se vores scripts i aktion. Videoer og billeder af hvad vi har lavet.' },
    { n: 'priser', navn: '💰┃priser', las: true, reager: true, alle: true, topic: 'Prisoversigt.' },
    { n: 'opdateringer', navn: '🆕┃opdateringer', las: true, reager: true, topic: 'Nye versioner og rettelser af vores produkter.' },
    { n: 'anmeldelser', navn: '⭐┃anmeldelser', las: true, reager: true, skriv: ['Kunde'], slow: 60, topic: 'Anmeldelser fra kunder. Kun kunder kan skrive her.' },
    { n: 'kundesupport', navn: '🛠️┃kunde-support', rolle: 'Kunde', topic: 'Hjælp til produkter, du har købt.' },
  ] }],
  andet: [],
  slut: [
    { id: 'partner', kat: '[ 🤝 | PARTNERE ]', kanaler: [
      { n: 'partnere', navn: '🤝┃samarbejdspartnere', las: true, reager: true, topic: 'Vores samarbejdspartnere. Vil du være partner? Opret en ticket og vælg Samarbejde.' },
      { n: 'reklame', navn: '📣┃reklame', slow: 21600, topic: 'Reklamér for din Discord-server eller dit projekt. Ét opslag hver 6. time. Ingen NSFW, scam eller pings.' },
    ] },
    { id: 'support', kat: '[ 🎫 | SUPPORT ]', kanaler: [{ n: 'ticket', navn: '🎫┃opret-ticket', las: true, topic: 'Tryk på en knap for at oprette en ticket.' }] },
    { id: 'voice', kat: '[ 🔊 | SNAK ]', kanaler: [
      { n: 'voice1', navn: '💬┃Hyggesnak 1', voice: true },
      { n: 'voice2', navn: '💬┃Hyggesnak 2', voice: true },
    ] },
    { id: 'staff', kat: '[ 🛡️ | STAFF ]', staff: true, kanaler: [
      { n: 'staffchat', navn: '🛡️┃staff-chat' },
      { n: 'ticketlog', navn: '📋┃ticket-log' },
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
const REGLER = [
  '**1.** Vis respekt. Ingen racisme, trusler eller hetz.',
  '**2.** Ingen spam, caps-spam eller reklame for andre servere.',
  '**3.** Ingen snyd, hacks, macros eller udnyttelse af fejl. Find du en fejl, så lav en ticket.',
  '**4.** Brug kanalerne til det, de er lavet til.',
  '**5.** Ingen NSFW eller ubehageligt indhold.',
  '**6.** Staff har altid det sidste ord. Er du uenig, så lav en ticket.',
];

// ---------- HJÆLPERE ----------
const info = g => data[g.id] || null;
const navnPaa = g => info(g)?.navn || g.name;
const farve = g => TYPER[info(g)?.type]?.farve || 0x22c55e;
const erStaff = (m, d) => m.permissions.has(P.Administrator) || m.guild.ownerId === m.id || STAFF_ROLLER.some(r => d?.roller?.[r] && m.roles.cache.has(d.roller[r]));
const svar = (i, tekst, ekstra = {}) => (i.replied || i.deferred ? i.editReply({ content: tekst, ...ekstra }) : i.reply({ content: tekst, flags: MessageFlags.Ephemeral, ...ekstra })).catch(() => {});

// ---------- ROLLER ----------
// Grund-rettigheder for rollerne (resten styres pr. kanal). Ingen almindelige medlemmer kan pinge @everyone eller roller.
const ROLLE_RET = {
  Ejer: [P.Administrator],
  Admin: [P.ManageGuild, P.ManageChannels, P.ManageRoles, P.ViewAuditLog, P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.ManageNicknames, P.MoveMembers, P.MuteMembers, P.DeafenMembers, P.MentionEveryone, P.ManageEvents],
  Mod: [P.ViewAuditLog, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.ManageNicknames, P.MoveMembers, P.MuteMembers, P.MentionEveryone],
  Hjælper: [P.ModerateMembers, P.ManageMessages, P.MoveMembers],
};
async function sikrRolle(g, d, r) {
  let rolle = d.roller[r.navn] && await g.roles.fetch(d.roller[r.navn]).catch(() => null);
  if (!rolle) rolle = g.roles.cache.find(x => x.name === r.navn && !x.managed) || await g.roles.create({ name: r.navn, color: r.farve, hoist: r.hoist, mentionable: false, permissions: [], reason: '/setup' });
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
  if (staffKat) { for (const s of staff) ow.push({ id: s, allow: staffRet }); return ow; }
  if (k.aaben) {
    const skriv = k.aaben === 'skriv';
    ow[0] = { id: g.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory, ...(skriv ? [P.SendMessages, P.AddReactions] : [])], deny: [P.CreatePublicThreads, P.CreatePrivateThreads, P.MentionEveryone, ...(skriv ? [] : [P.SendMessages, P.AddReactions])] };
    // verificerede (Spiller, Kunde, Vagt ...) ser dem ikke. Staff kan stadig se dem for at hjælpe nye.
    for (const [navn, id] of Object.entries(d.roller)) if (!STAFF_ROLLER.includes(navn) && navn !== 'Bots' && id) ow.push({ id, deny: [P.ViewChannel] });
    for (const s of staff) ow.push({ id: s, allow: staffRet });
    return ow;
  }
  const laesning = [P.ViewChannel, P.ReadMessageHistory, ...(k.reager ? [P.AddReactions] : [])];
  const laesNej = [...LAAS, ...(k.reager ? [] : [P.AddReactions])];
  if (k.alle) ow[0] = { id: g.roles.everyone.id, allow: laesning, deny: laesNej };
  if (k.rolle) {
    if (d.roller[k.rolle]) ow.push({ id: d.roller[k.rolle], allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions] });
  } else if (spiller) {
    if (k.voice) ow.push({ id: spiller, allow: [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD] });
    else if (k.las) ow.push({ id: spiller, allow: laesning, deny: laesNej });
    else ow.push({ id: spiller, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions], deny: [P.CreatePublicThreads, P.CreatePrivateThreads] });
  }
  for (const r of k.skriv || []) if (d.roller[r]) ow.push({ id: d.roller[r], allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.AddReactions] });
  for (const s of staff) ow.push({ id: s, allow: staffRet });
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
  const standard = Object.values(d.kanaler).filter(synlig).filter(id => g.channels.cache.get(id).type !== ChannelType.GuildCategory);
  await g.client.rest.put(`/guilds/${g.id}/onboarding`, { body: { enabled: true, mode: 0, default_channel_ids: standard, prompts } })
    .catch(e => rapport.push(`Onboarding: ${e.message} ${JSON.stringify(e.rawError?.errors || '').slice(0, 250)}`));
}
// Discords egen regelskærm: man skal acceptere reglerne, før man kan skrive. Bagefter får man automatisk Spiller.
async function saetRegelskaerm(g, d, rapport) {
  await g.client.rest.patch(`/guilds/${g.id}/member-verification`, { body: { enabled: true,
    description: `Velkommen til ${navnPaa(g)}! Læs og accepter reglerne for at få adgang.`,
    form_fields: [{ field_type: 'TERMS', label: 'Læs og accepter reglerne', required: true, values: REGLER.map(x => x.replace(/^\*\*\d+\.\*\* /, '')) }] } })
    .catch(e => rapport.push(`Regelskærm: ${e.message}`));
}

// Bygger/retter hele serveren efter skabelonen. Bruges af /setup og automatisk, når skabelonen bliver opdateret.
const SKABELON_V = 13;
async function byg(g, d, type) {
  const rapport = [];
  spor(`byg start ${g.name} (${type})`);
  for (const r of [...ROLLER.faelles, ...ROLLER[type]]) await sikrRolle(g, d, r);
  gem();
  await g.channels.fetch();
  const grupper = [...KANALER.start, ...KANALER[type], ...KANALER.slut];
  const forummer = [];
  for (const [nr, gr] of grupper.entries()) {
    const kat = await sikrKanal(g, d, `kat_${gr.id}`, { name: gr.kat, type: ChannelType.GuildCategory, position: nr,
      permissionOverwrites: gr.staff ? rettigheder(g, d, {}, true) : undefined }, rapport);
    if (!kat) continue;
    for (const k of gr.kanaler.filter(k => !k.ikke?.includes(type))) {
      const opts = { name: k.navn, type: k.voice ? ChannelType.GuildVoice : ChannelType.GuildText, parent: kat.id,
        permissionOverwrites: rettigheder(g, d, k, gr.staff), ...(k.voice ? {} : { topic: k.topic || '', rateLimitPerUser: k.slow || 0 }) };
      if (k.forum) { forummer.push([k, opts]); continue; }
      await sikrKanal(g, d, k.n, opts, rapport);
    }
    gem();
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
  const gammel = (await kanal.messages.fetch({ limit: 20 }).catch(() => null))?.find(m => m.author.id === kanal.client.user.id);
  return gammel ? gammel.edit(besked).catch(() => kanal.send(besked)) : kanal.send(besked);
}

async function postPaneler(g, d) {
  const f = farve(g), navn = navnPaa(g);
  const regler = await g.channels.fetch(d.kanaler.regler).catch(() => null);
  if (regler) await sendEllerRet(regler, {
    embeds: [new EmbedBuilder().setColor(f).setAuthor({ name: navn }).setTitle('📜 Regler')
      .setDescription([...REGLER, '', 'Tryk på knappen nedenfor for at acceptere reglerne og få adgang til serveren.'].join('\n'))],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('nv_verify').setLabel('Jeg accepterer reglerne').setEmoji('✅').setStyle(ButtonStyle.Success))],
  });
  const ticket = await g.channels.fetch(d.kanaler.ticket).catch(() => null);
  if (ticket) await sendEllerRet(ticket, {
    embeds: [new EmbedBuilder().setColor(f).setAuthor({ name: navn }).setTitle('🎫 Opret en ticket')
      .setDescription(TICKET_TEKST[d.type] || TICKET_TEKST.standard)],
    components: [new ActionRowBuilder().addComponents(...TICKETS[d.type].map(([id, label, emoji]) =>
      new ButtonBuilder().setCustomId(`nv_tk_${id}`).setLabel(label).setEmoji(emoji).setStyle(id === 'anmeld' ? ButtonStyle.Danger : ButtonStyle.Primary)))],
  });
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

// ---------- TICKETS ----------
async function aabnTicket(i, slags) {
  const g = i.guild, d = info(g);
  const valg = TICKETS[d.type].find(x => x[0] === slags);
  if (!valg) return svar(i, '❌ Ukendt ticket-type.');
  const aaben = g.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
  if (aaben) return svar(i, `Du har allerede en åben ticket: ${aaben}`);
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const kat = d.kanaler.kat_support && await g.channels.fetch(d.kanaler.kat_support).catch(() => null);
  const staff = STAFF_ROLLER.map(r => d.roller[r]).filter(Boolean);
  const kanal = await g.channels.create({
    name: `${slags}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9æøå-]/g, '').slice(0, 90) || `ticket-${i.user.id}`,
    type: ChannelType.GuildText, parent: kat?.id, topic: `ticket:${i.user.id}`,
    permissionOverwrites: [
      { id: g.roles.everyone.id, deny: [P.ViewChannel] },
      { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
      ...staff.map(s => ({ id: s, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] })),
    ],
  });
  await kanal.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setColor(farve(g)).setAuthor({ name: navnPaa(g) })
    .setTitle(`${valg[2]} ${valg[1]}`)
    .setDescription(d.type === 'shop' ? 'Tak for din ticket! Skriv hvilket script du er interesseret i, eller hvad du har brug for, så svarer vi hurtigst muligt.' : 'Tak for din ticket! Skriv så meget som muligt om din sag, så svarer staff hurtigst muligt.\nSkriv også dit **Minecraft-navn**.')],
    components: [new ActionRowBuilder().addComponents(
      ...(d.type === 'shop' && ['koeb', 'bestil'].includes(slags) ? [new ButtonBuilder().setCustomId('nv_kunde').setLabel('Køb gennemført (staff)').setEmoji('✅').setStyle(ButtonStyle.Success)] : []),
      new ButtonBuilder().setCustomId('nv_luk').setLabel('Luk ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger))] });
  return i.editReply(`✅ Din ticket er oprettet: ${kanal}`);
}

async function lukTicket(i) {
  const g = i.guild, d = info(g), kanal = i.channel;
  const ejer = String(kanal.topic || '').replace('ticket:', '');
  if (!String(kanal.topic || '').startsWith('ticket:')) return svar(i, '❌ Det her er ikke en ticket.');
  if (ejer !== i.user.id && !erStaff(i.member, d)) return svar(i, '❌ Kun den der lavede ticketen eller staff kan lukke den.');
  await i.reply({ content: '🔒 Ticketen lukkes om 5 sekunder ...' });
  const beskeder = await kanal.messages.fetch({ limit: 100 }).catch(() => null);
  const tekst = beskeder ? [...beskeder.values()].reverse().map(m => `[${new Date(m.createdTimestamp).toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' })}] ${m.author.tag}: ${m.content || (m.embeds.length ? '(embed)' : '')}`).join('\n') : '';
  const logK = d.kanaler.ticketlog && await g.channels.fetch(d.kanaler.ticketlog).catch(() => null);
  if (logK) await logK.send({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('🔒 Ticket lukket')
    .setDescription(`**Ticket:** ${kanal.name}\n**Lavet af:** <@${ejer}>\n**Lukket af:** ${i.user}`).setTimestamp()],
    files: tekst ? [new AttachmentBuilder(Buffer.from(tekst, 'utf8'), { name: `${kanal.name}.txt` })] : [] }).catch(() => {});
  setTimeout(() => kanal.delete('Ticket lukket').catch(() => {}), 5000);
}

// ---------- KOMMANDOER ----------
const lavKommandoer = typer => [
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
    const stats = () => { for (const g of andre()) opdaterStats(g, info(g)).catch(e => spor(`stats: ${e.message}`)); };
    setTimeout(stats, 60000).unref?.(); setInterval(stats, 10 * 60000).unref?.();
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
    try {
      const d = info(i.guild);
      if (i.isChatInputCommand()) {
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
          if (!rolle) return svar(i, '❌ Rollen Spiller findes ikke. Bed en admin køre /setup igen.');
          if (i.member.roles.cache.has(rolle)) return svar(i, '✅ Du har allerede adgang!');
          await i.member.roles.add(rolle, 'Accepterede reglerne');
          return svar(i, `✅ Velkommen! Du har nu adgang til ${navnPaa(i.guild)}. Kig i <#${d.kanaler.chat}>.`);
        }
        if (i.customId.startsWith('nv_tk_')) return aabnTicket(i, i.customId.slice(6));
        if (i.customId === 'nv_luk') return lukTicket(i);
        if (i.customId === 'nv_kunde') {
          if (!erStaff(i.member, d)) return svar(i, '❌ Kun staff kan markere et køb som gennemført.');
          const ejer = String(i.channel?.topic || '').replace('ticket:', '');
          const m = ejer && await i.guild.members.fetch(ejer).catch(() => null);
          if (!m || !d.roller.Kunde) return svar(i, '❌ Kunne ikke finde kunden.');
          if (m.roles.cache.has(d.roller.Kunde)) return svar(i, `✅ ${m} er allerede kunde.`);
          await m.roles.add(d.roller.Kunde, `Køb gennemført (markeret af ${i.user.tag})`);
          await i.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Køb gennemført')
            .setDescription(`Tak for dit køb, ${m}! 🐐\nDu har fået rollen **Kunde** og kan nu skrive i ${d.kanaler.anmeldelser ? `<#${d.kanaler.anmeldelser}>` : '#anmeldelser'} og få hjælp i ${d.kanaler.kundesupport ? `<#${d.kanaler.kundesupport}>` : '#kunde-support'}.`)] });
          await log(i.guild, '🛒 Ny kunde', [`${m} fik rollen **Kunde** (markeret af ${i.user}).`], 0x22c55e);
          return statsSnart(i.guild);
        }
      }
    } catch (e) {
      console.error(`Netværk (${i.guild?.name}):`, e);
      svar(i, `❌ Noget gik galt: ${e.message}`);
    }
  });
}

// ---------- GEDERNE BUTIK BOT (separat bot) ----------
// Logo og banner (sættes én gang pr. version: serverikon, bottens profilbillede og -banner)
const SHOP_GRAFIK = { v: 4, servernavn: '🐐 | Gederne Shop', visningsnavn: 'Gederne Shop',
  logo: 'https://raw.githubusercontent.com/Krainer2/hopdop-discord-bot/b818a5fc22e0fd2c33db05df5dd8ea4081d43c3c/g1.png',
  banner: 'https://raw.githubusercontent.com/Krainer2/hopdop-discord-bot/b818a5fc22e0fd2c33db05df5dd8ea4081d43c3c/g2.jpg' };
async function saetShopGrafik(shop) {
  data._shopbot = data._shopbot || {};
  if (data._shopbot.grafikV === SHOP_GRAFIK.v) return;
  const hent = async u => { const r = await fetch(u); if (!r.ok) throw new Error(`download ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
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
      if (g.name !== SHOP_GRAFIK.servernavn) await g.setName(SHOP_GRAFIK.servernavn, 'Servernavn').then(() => ud.push('servernavn')).catch(e => ud.push(`servernavn FEJL ${e.message}`));
      if (data[g.id] && data[g.id].navn !== SHOP_GRAFIK.visningsnavn) { data[g.id].navn = SHOP_GRAFIK.visningsnavn; gem(); } // navnet i bottens beskeder (uden emoji)
      await g.setIcon(logo, 'Logo').then(() => ud.push(`ikon ${g.name}`)).catch(e => ud.push(`ikon FEJL ${e.message}`));
      if (g.premiumTier >= 2) await g.setBanner(banner, 'Banner').catch(() => {});
      if (g.premiumTier >= 1) await g.setSplash(banner, 'Banner').catch(() => {});
    }
    spor(`shop-grafik: ${ud.join(', ')}`);
    if (!ud.some(x => x.includes('FEJL'))) { data._shopbot.grafikV = SHOP_GRAFIK.v; data._shopbot.profilV = 1; gem(); }
  } catch (e) { spor(`shop-grafik fejl: ${e.message}`); }
}
const SHOP_OM_MIG = 'Botten bag Gederne Shop 🐐\nKøb scripts, se showcases og bestil custom scripts. Opret en ticket i #opret-ticket.\n\n📨 Join: https://discord.gg/EaDhda9TjA';
function startShopBot() {
  const { Client, GatewayIntentBits, ActivityType, OAuth2Scopes } = require('discord.js');
  const shop = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
  start(shop, shop.on.bind(shop), null, ['shop']);
  shop.once('clientReady', async () => {
    console.log('Gederne Butik Bot er online som', shop.user.tag);
    await saetShopGrafik(shop);
    shop.user.setPresence({ activities: [{ name: 'Gederne Shop 🐐', type: ActivityType.Watching }], status: 'online' });
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
