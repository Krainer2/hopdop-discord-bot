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
// las = kun læse (spillere kan ikke skrive). rolle = kun den rolle (+ staff) kan se kanalen. ikke = springes over for de typer.
const KANALER = {
  start: [
    { kat: '📌 INFO', kanaler: [
      { n: 'regler', navn: '📜┃regler', las: true, alle: true },
      { n: 'velkommen', navn: '👋┃velkommen', las: true },
      { n: 'nyheder', navn: '📢┃nyheder', las: true },
      { n: 'devlog', navn: '🛠️┃dev-log', las: true },
      { n: 'serverip', navn: '🌐┃server-ip', las: true, ikke: ['shop'] },
    ] },
    { kat: '💬 COMMUNITY', kanaler: [
      { n: 'chat', navn: '💬┃chat' },
      { n: 'botkmd', navn: '🤖┃bot-kommandoer' },
      { n: 'forslag', navn: '💡┃forslag' },
    ] },
  ],
  prison: [{ kat: '🔒 PRISON', kanaler: [
    { n: 'vagtinfo', navn: '🚔┃bliv-vagt', las: true },
    { n: 'ranks', navn: '🏢┃celler-og-ranks', las: true },
    { n: 'vagtchat', navn: '👮┃vagt-chat', rolle: 'Vagt' },
  ] }],
  kitpvp: [{ kat: '⚔️ KITPVP', kanaler: [
    { n: 'kits', navn: '🗡️┃kits', las: true },
    { n: 'duels', navn: '🥊┃duels' },
    { n: 'leaderboard', navn: '🏆┃leaderboard', las: true },
    { n: 'clips', navn: '🎬┃clips' },
  ] }],
  uhc: [{ kat: '🍎 UHC', kanaler: [
    { n: 'uhcevents', navn: '📣┃uhc-events', las: true },
    { n: 'hosting', navn: '⏰┃hosting-tider', las: true },
    { n: 'teamsoeg', navn: '🤝┃team-søgning' },
    { n: 'halloffame', navn: '🏆┃hall-of-fame', las: true },
  ] }],
  shop: [{ kat: '🛒 SHOP', kanaler: [
    { n: 'produkter', navn: '📦┃produkter', las: true },
    { n: 'showcase', navn: '🎬┃showcase', las: true },
    { n: 'priser', navn: '💰┃priser', las: true },
    { n: 'opdateringer', navn: '🆕┃opdateringer', las: true },
    { n: 'anmeldelser', navn: '⭐┃anmeldelser' },
    { n: 'kundesupport', navn: '🛠️┃kunde-support', rolle: 'Kunde' },
  ] }],
  andet: [],
  slut: [
    { kat: '🎫 SUPPORT', kanaler: [{ n: 'ticket', navn: '🎫┃opret-ticket', las: true }] },
    { kat: '🔊 VOICE', kanaler: [
      { n: 'voice1', navn: '🔊 Snak 1', voice: true },
      { n: 'voice2', navn: '🔊 Snak 2', voice: true },
    ] },
    { kat: '🛡️ STAFF', staff: true, kanaler: [
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

async function sikrRolle(g, d, r) {
  let rolle = d.roller[r.navn] && await g.roles.fetch(d.roller[r.navn]).catch(() => null);
  if (!rolle) rolle = g.roles.cache.find(x => x.name === r.navn) || await g.roles.create({ name: r.navn, color: r.farve, hoist: r.hoist, reason: '/setup' });
  d.roller[r.navn] = rolle.id;
  return rolle;
}

function rettigheder(g, d, k, staffKat) {
  const ow = [{ id: g.roles.everyone.id, deny: [P.ViewChannel] }];
  const staff = STAFF_ROLLER.map(r => d.roller[r]).filter(Boolean);
  const spiller = d.roller.Spiller;
  if (staffKat) {
    for (const s of staff) ow.push({ id: s, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
    return ow;
  }
  if (k.alle) ow[0] = { id: g.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] };
  if (k.rolle) {
    if (d.roller[k.rolle]) ow.push({ id: d.roller[k.rolle], allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
  } else if (spiller) {
    ow.push(k.las
      ? { id: spiller, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] }
      : { id: spiller, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, ...(k.voice ? [P.Connect, P.Speak] : [])] });
  }
  for (const s of staff) ow.push({ id: s, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, ...(k.voice ? [P.Connect, P.Speak] : [])] });
  return ow;
}

async function sikrKanal(g, d, noegle, opts) {
  let k = d.kanaler[noegle] && await g.channels.fetch(d.kanaler[noegle]).catch(() => null);
  if (!k) k = await g.channels.create({ ...opts, reason: '/setup' });
  d.kanaler[noegle] = k.id;
  return k;
}

// ---------- /setup ----------
async function setup(i, type, navn) {
  const g = i.guild;
  const d = data[g.id] = data[g.id] || { roller: {}, kanaler: {} };
  d.type = type; if (navn) d.navn = navn; d.ip = d.ip || '';
  const t = TYPER[type];
  await i.editReply(`⏳ Sætter **${navnPaa(g)}** op som **${t.navn}**-server. Det tager et øjeblik ...`);

  for (const r of [...ROLLER.faelles, ...ROLLER[type]]) await sikrRolle(g, d, r);
  gem();

  const grupper = [...KANALER.start, ...KANALER[type], ...KANALER.slut];
  for (const [nr, gr] of grupper.entries()) {
    const katNoegle = `kat_${gr.kat.replace(/[^a-zæøå]/gi, '').toLowerCase()}`;
    const kat = await sikrKanal(g, d, katNoegle, { name: gr.kat, type: ChannelType.GuildCategory, position: nr,
      permissionOverwrites: gr.staff ? rettigheder(g, d, {}, true) : [{ id: g.roles.everyone.id, deny: [] }] });
    for (const k of gr.kanaler.filter(k => !k.ikke?.includes(type))) {
      await sikrKanal(g, d, k.n, { name: k.navn, type: k.voice ? ChannelType.GuildVoice : ChannelType.GuildText, parent: kat.id,
        permissionOverwrites: rettigheder(g, d, k, gr.staff) });
    }
    gem();
  }

  await postPaneler(g, d);
  d.sat = new Date().toISOString(); gem();
  await log(g, `✅ **/setup ${type}** kørt af ${i.user}.`);
  return i.editReply([
    `✅ **${navnPaa(g)}** er sat op som **${t.navn}**-server!`, '',
    `• Roller: ${[...ROLLER.faelles, ...ROLLER[type]].map(r => `<@&${d.roller[r.navn]}>`).join(' ')}`,
    `• Regler med verificerings-knap: <#${d.kanaler.regler}>`,
    `• Ticket-panel: <#${d.kanaler.ticket}>`, '',
    '**Husk:**',
    '**1.** Giv dig selv rollen **Ejer**.',
    ...(type === 'shop' ? [] : ['**2.** Sæt Minecraft-IP\'en, når serveren er klar: `/indstil ip:<ip>`']),
    `**${type === 'shop' ? 2 : 3}.** Kør bare \`/setup\` igen, hvis noget mangler. Botten genbruger det, der allerede findes.`,
  ].join('\n'));
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

  onAlle('clientReady', () => { for (const g of andre()) registrer(g); });
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
  const shop = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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
