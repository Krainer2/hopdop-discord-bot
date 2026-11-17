// (c) 2026 Krainer2 - Alle rettigheder forbeholdt
// NETVÆRK: HOPDOP Bot på de andre HopDop-servere (Prison, KitPvP ...).
// Gederne Butik Bot: en HELT separat bot (eget navn/token: SHOP_TOKEN i .env), der kører fra samme proces.
// Den nævner aldrig HopDop, så butikken ikke kan spores tilbage.
// HopDop selv (GUILD_ID) styres stadig KUN af index.js. Denne fil rører aldrig HopDop-serveren.
// Data for hver server gemmes i servere.json (lokal fil, uploades ikke til GitHub).
const fs = require('fs');
const { ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');

const FIL = 'servere.json';
const hent = () => { try { return JSON.parse(fs.readFileSync(FIL, 'utf8')); } catch { return {}; } };
const data = hent();
const gem = () => fs.writeFileSync(FIL, JSON.stringify(data, null, 2));

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
const KANALER = {
  start: [
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
    { n: 'produkter', navn: '📦┃produkter', las: true, reager: true, alle: true, forum: { tags: [['Skript', '📜'], ['Plugin', '🧩'], ['Setup', '🏗️'], ['Gratis', '🎁'], ['Nyt', '🆕'], ['Udsalg', '🏷️']], reaktion: '🔥' },
      topic: 'Alle vores produkter. Ét opslag pr. produkt med billeder, pris og beskrivelse. Køb via en ticket i #opret-ticket.' },
    { n: 'showcase', navn: '🎬┃showcase', las: true, reager: true, alle: true, forum: { tags: [['Video', '🎥'], ['Billeder', '🖼️'], ['Opdatering', '🆕'], ['Custom', '✍️']], reaktion: '🔥' },
      topic: 'Se vores scripts i aktion. Videoer og billeder af hvad vi har lavet.' },
    { n: 'priser', navn: '💰┃priser', las: true, reager: true, alle: true, topic: 'Prisoversigt.' },
    { n: 'opdateringer', navn: '🆕┃opdateringer', las: true, reager: true, topic: 'Nye versioner og rettelser af vores produkter.' },
    { n: 'anmeldelser', navn: '⭐┃anmeldelser', las: true, reager: true, skriv: ['Kunde'], slow: 60, topic: 'Anmeldelser fra kunder. Kun kunder kan skrive her.' },
    { n: 'kundesupport', navn: '🛠️┃kunde-support', rolle: 'Kunde', topic: 'Hjælp til produkter, du har købt.' },
  ] }],
  andet: [],
  slut: [
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
  prison: [['support', 'Support', '🛠️'], ['vagt', 'Vagt-ansøgning', '👮'], ['anmeld', 'Anmeld spiller', '🚨']],
  kitpvp: [['support', 'Support', '🛠️'], ['ansog', 'Staff-ansøgning', '📝'], ['anmeld', 'Anmeld spiller', '🚨']],
  uhc: [['support', 'Support', '🛠️'], ['host', 'Host-ansøgning', '🎙️'], ['anmeld', 'Anmeld spiller', '🚨']],
  shop: [['koeb', 'Køb et script', '🛒'], ['bestil', 'Bestil custom script', '✍️'], ['support', 'Support', '🛠️']],
  andet: [['support', 'Support', '🛠️'], ['ansog', 'Staff-ansøgning', '📝'], ['anmeld', 'Anmeld spiller', '🚨']],
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
    for (const m of (await g.members.fetch().catch(() => new Map())).values()) if (m.user.bot && !m.roles.cache.has(bots.id)) await m.roles.add(bots).catch(() => {});
  }
  // Rækkefølge (kun roller under bottens egen rolle kan flyttes)
  const top = mig.roles.highest.position;
  const raekke = [...alle.map(r => g.roles.cache.get(d.roller[r.navn])), bots].filter(Boolean);
  const n = raekke.length;
  if (raekke.every(r => r.position < top) && top - n >= 1) {
    await g.roles.setPositions(raekke.map((r, i) => ({ role: r.id, position: top - 1 - i })))
      .catch(e => rapport.push(`Rolle-rækkefølge: ${e.message} (bot=${mig.roles.highest.name}@${top}; ${[...g.roles.cache.values()].sort((a, b) => b.position - a.position).map(x => `${x.name}@${x.position}`).join(', ')})`));
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
    if (opts.topic !== undefined && 'topic' in k && k.topic !== opts.topic) aendr.topic = opts.topic;
    if (opts.rateLimitPerUser !== undefined && 'rateLimitPerUser' in k && k.rateLimitPerUser !== opts.rateLimitPerUser) aendr.rateLimitPerUser = opts.rateLimitPerUser;
    if (k.type === ChannelType.GuildForum && opts.defaultForumLayout !== undefined && k.defaultForumLayout !== opts.defaultForumLayout) aendr.defaultForumLayout = opts.defaultForumLayout;
    if (Object.keys(aendr).length) await k.edit({ ...aendr, reason: '/setup' }).catch(e => rapport.push(`${opts.name}: ${e.message}`));
    if (opts.permissionOverwrites) await k.permissionOverwrites.set(opts.permissionOverwrites, '/setup').catch(e => rapport.push(`Rettigheder ${opts.name}: ${e.message}`));
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

// Bygger/retter hele serveren efter skabelonen. Bruges af /setup og automatisk, når skabelonen bliver opdateret.
const SKABELON_V = 4;
async function byg(g, d, type) {
  const rapport = [];
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
  // Rækkefølge på kategorierne
  await g.channels.setPositions(grupper.map((gr, i) => d.kanaler[`kat_${gr.id}`] && { channel: d.kanaler[`kat_${gr.id}`], position: i }).filter(Boolean)).catch(() => {});
  await saetCommunity(g, d, rapport);
  // Forummer med galleri (kræver Community)
  for (const [k, opts] of forummer) {
    await sikrKanal(g, d, k.n, { ...opts, type: ChannelType.GuildForum, defaultForumLayout: 2 /* galleri */, defaultSortOrder: 1,
      availableTags: k.forum.tags.map(([name, emoji]) => ({ name, emoji: { id: null, name: emoji }, moderated: true })),
      defaultReactionEmoji: { id: null, name: k.forum.reaktion } }, rapport)
      || await sikrKanal(g, d, k.n, opts, rapport); // uden Community: almindelig kanal i stedet
  }
  gem();
  await saetVelkomst(g, d, rapport);
  await ordnRoller(g, d, type, rapport);
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
  await log(g, `✅ **/setup ${type}** kørt af ${i.user}.${rapport.length ? `\n⚠️ ${rapport.join('\n⚠️ ')}` : ''}`);
  return i.editReply([
    `✅ **${navnPaa(g)}** er sat op som **${t.navn}**-server!`, '',
    `• Roller: ${[...ROLLER.faelles, ...ROLLER[type]].map(r => `<@&${d.roller[r.navn]}>`).join(' ')}`,
    `• Regler med verificerings-knap: <#${d.kanaler.regler}>`,
    `• Ticket-panel: <#${d.kanaler.ticket}>`,
    ...(rapport.length ? ['', `⚠️ **Det gik ikke helt:**`, ...rapport.slice(0, 8).map(x => `• ${x}`)] : []), '',
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

async function log(g, tekst) {
  const d = info(g);
  const k = d?.kanaler?.botlog && await g.channels.fetch(d.kanaler.botlog).catch(() => null);
  if (k) await k.send({ content: tekst, allowedMentions: { parse: [] } }).catch(() => {});
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
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('nv_luk').setLabel('Luk ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger))] });
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
    for (const g of andre()) {
      await registrer(g);
      // Ny skabelon (fx forummer, rettigheder): opdatér servere, der allerede er sat op
      const d = info(g);
      if (d?.type && d.sat && d.skabelonV !== SKABELON_V) {
        const rapport = await byg(g, d, d.type).catch(e => [e.message]);
        await postPaneler(g, d).catch(() => {});
        console.log(`Netværk: ${g.name} er opdateret til skabelon ${SKABELON_V}.${rapport.length ? ' Problemer: ' + rapport.join(' | ') : ''}`);
        await log(g, `🔄 Serveren er opdateret til den nye skabelon (forummer, rettigheder og medlemsliste).${rapport.length ? `\n⚠️ ${rapport.join('\n⚠️ ')}` : ''}`);
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
          await log(i.guild, `⚙️ ${i.user} ændrede indstillinger${ip ? ` · IP: \`${d.ip || 'ingen'}\`` : ''}${navn ? ` · navn: **${d.navn}**` : ''}`);
          return svar(i, '✅ Gemt!');
        }
        if (i.commandName === 'ip') {
          return i.reply({ embeds: [new EmbedBuilder().setColor(farve(i.guild)).setTitle('🌐 Server-IP')
            .setDescription(d?.ip ? `**IP:** \`${d.ip}\`` : '⏳ Serveren er ikke åben endnu.')] });
        }
        if (i.commandName === 'say') {
          if (!d || !erStaff(i.member, d)) return svar(i, '❌ Kun staff kan bruge /say.');
          await i.channel.send({ content: i.options.getString('tekst'), allowedMentions: { parse: [] } });
          await log(i.guild, `💬 ${i.user} brugte /say i ${i.channel}.`);
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
      }
    } catch (e) {
      console.error(`Netværk (${i.guild?.name}):`, e);
      svar(i, `❌ Noget gik galt: ${e.message}`);
    }
  });
}

// ---------- GEDERNE BUTIK BOT (separat bot) ----------
const SHOP_OM_MIG = 'Botten bag Gederne Shop 🐐\nKøb scripts, se showcases og bestil custom scripts. Opret en ticket i #opret-ticket.';
function startShopBot() {
  const { Client, GatewayIntentBits, ActivityType, OAuth2Scopes } = require('discord.js');
  const shop = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages] });
  start(shop, shop.on.bind(shop), null, ['shop']);
  shop.once('clientReady', async () => {
    console.log('Gederne Butik Bot er online som', shop.user.tag);
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
