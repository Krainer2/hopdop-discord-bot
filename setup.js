// HOPDOP Discord opsætning - kør ÉN gang: node setup.js
// (c) 2026 Krainer2
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits: P,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const FARVE = 0x3b82f6;

// Roller, højeste først (så den højeste havner øverst)
const ROLLER = [
  { navn: 'Ejer',      farve: 0xdc2626, staff: true, hoist: true, perms: [P.Administrator] },
  { navn: 'Admin',     farve: 0xef4444, staff: true, hoist: true, perms: [P.ManageChannels, P.ManageRoles, P.ManageMessages, P.KickMembers, P.BanMembers, P.ModerateMembers, P.ViewAuditLog, P.MentionEveryone, P.ManageNicknames] },
  { navn: 'Mod',       farve: 0xa855f7, staff: true, hoist: true, perms: [P.ManageMessages, P.KickMembers, P.ModerateMembers, P.ManageNicknames, P.ViewAuditLog] },
  { navn: 'Hjælper',   farve: 0x22c55e, staff: true, hoist: true, perms: [P.ManageMessages, P.ModerateMembers] },
  { navn: 'Builder',   farve: 0x06b6d4, hoist: true },
  { navn: 'Event',     farve: 0x6366f1, hoist: true },
  { navn: 'Partner',   farve: 0xec4899, hoist: true },
  { navn: 'Streamer',  farve: 0x9333ea, hoist: true },
  { navn: 'Legende',   farve: 0x991b1b, hoist: true },
  { navn: 'Mester',    farve: 0xd946ef, hoist: true },
  { navn: 'Diamant',   farve: 0x38bdf8, hoist: true },
  { navn: 'Guld',      farve: 0xfacc15, hoist: true },
  { navn: 'Sølv',      farve: 0x9ca3af, hoist: true },
  { navn: 'Bronze',    farve: 0xd97706, hoist: true },
  { navn: 'Spiller',   farve: 0x64748b },
];

// type: 'info' = alle ser, kun staff skriver | 'chat' = Spiller skriver | 'staff' = kun staff | 'laes' = Spiller ser, kun staff skriver
const STRUKTUR = [
  { kategori: '📌 INFORMATION', kanaler: [
    { id: 'velkommen', navn: '👋┃velkommen', type: 'info' },
    { id: 'regler',    navn: '📜┃regler', type: 'info' },
    { id: 'nyheder',   navn: '📢┃nyheder', type: 'laes' },
    { id: 'events',    navn: '🎉┃events', type: 'laes' },
    { id: 'devlog',    navn: '🛠┃dev-log', type: 'laes' },
    { id: 'serverip',  navn: '🌐┃server-ip', type: 'laes' },
  ]},
  { kategori: '💬 COMMUNITY', kanaler: [
    { id: 'chat',      navn: '💬┃chat', type: 'chat' },
    { id: 'medier',    navn: '📸┃medier', type: 'chat' },
    { id: 'forslag',   navn: '💡┃forslag', type: 'chat' },
    { id: 'giveaways', navn: '🎁┃giveaways', type: 'laes' },
    { id: 'botcmd',    navn: '🤖┃bot-kommandoer', type: 'chat' },
  ]},
  { kategori: '🎫 SUPPORT', id: 'support', kanaler: [
    { id: 'ticket',    navn: '🎫┃opret-ticket', type: 'laes' },
    { id: 'fejl',      navn: '🐞┃fejlrapporter', type: 'chat' },
    { id: 'ansog',     navn: '📝┃ansøgninger', type: 'chat' },
  ]},
  { kategori: '🔊 VOICE', kanaler: [
    { navn: '🔊 Lounge', type: 'voice' },
    { navn: '🎮 Duo 1', type: 'voice', grense: 2 },
    { navn: '🎮 Duo 2', type: 'voice', grense: 2 },
    { navn: '🎪 Event', type: 'voice' },
  ]},
  { kategori: '🔒 STAFF', kanaler: [
    { id: 'staffchat', navn: '🔒┃staff-chat', type: 'staff' },
    { id: 'vagtplan',  navn: '🗓┃vagtplan', type: 'staff' },
    { id: 'straflog',  navn: '⚖┃straf-log', type: 'staff' },
    { id: 'modnoter',  navn: '📝┃mod-noter', type: 'staff' },
    { id: 'ticketlog', navn: '📁┃ticket-log', type: 'staff' },
    { id: 'staffvoice', navn: '🔒 Staff voice', type: 'voice-staff' },
  ]},
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();
    console.log('Opsætter:', guild.name);

    const config = { roller: {}, kanaler: {} };

    // ---- ROLLER ----
    for (const r of ROLLER) {
      let rolle = guild.roles.cache.find(x => x.name === r.navn);
      if (!rolle) {
        rolle = await guild.roles.create({
          name: r.navn, color: r.farve, hoist: !!r.hoist, mentionable: false,
          permissions: r.perms || [], reason: 'HOPDOP opsætning',
        });
        console.log('Rolle oprettet:', r.navn);
      } else console.log('Rolle findes:', r.navn);
      config.roller[r.navn] = rolle.id;
    }
    const staff = ROLLER.filter(r => r.staff).map(r => config.roller[r.navn]);
    const spiller = config.roller['Spiller'];
    const everyone = guild.roles.everyone.id;

    // Alle skal have Spiller-rollen at skrive, så Spiller får grundrettigheder
    const spillerRolle = guild.roles.cache.get(spiller);
    await spillerRolle.setPermissions([P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions,
      P.AttachFiles, P.EmbedLinks, P.UseExternalEmojis, P.Connect, P.Speak, P.UseVAD, P.CreatePublicThreads, P.SendMessagesInThreads, P.ChangeNickname]);

    const staffAllow = staff.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages, P.Connect, P.Speak] }));

    function overwrites(type, kategoriType) {
      if (type === 'info') return [
        { id: everyone, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] }, ...staffAllow];
      if (type === 'laes') return [
        { id: everyone, deny: [P.ViewChannel] },
        { id: spiller, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] }, ...staffAllow];
      if (type === 'chat') return [
        { id: everyone, deny: [P.ViewChannel] },
        { id: spiller, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }, ...staffAllow];
      if (type === 'voice') return [
        { id: everyone, deny: [P.ViewChannel] },
        { id: spiller, allow: [P.ViewChannel, P.Connect, P.Speak] }, ...staffAllow];
      return [ // staff / voice-staff
        { id: everyone, deny: [P.ViewChannel] }, ...staffAllow];
    }

    // ---- KATEGORIER + KANALER ----
    for (const blok of STRUKTUR) {
      let kat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === blok.kategori);
      if (!kat) {
        kat = await guild.channels.create({ name: blok.kategori, type: ChannelType.GuildCategory });
        console.log('Kategori oprettet:', blok.kategori);
      }
      if (blok.id) config.kanaler[blok.id] = kat.id;
      for (const k of blok.kanaler) {
        const erVoice = k.type === 'voice' || k.type === 'voice-staff';
        const type = erVoice ? ChannelType.GuildVoice : ChannelType.GuildText;
        let ch = guild.channels.cache.find(c => c.parentId === kat.id && c.name === k.navn.toLowerCase().replace(/ /g, erVoice ? ' ' : '-'));
        if (!ch) ch = guild.channels.cache.find(c => c.parentId === kat.id && c.name === k.navn);
        if (!ch) {
          ch = await guild.channels.create({
            name: k.navn, type, parent: kat.id,
            userLimit: k.grense || undefined,
            permissionOverwrites: overwrites(k.type),
          });
          console.log('Kanal oprettet:', k.navn);
        } else console.log('Kanal findes:', k.navn);
        if (k.id) config.kanaler[k.id] = ch.id;
      }
    }

    // ---- REGLER MED VERIFICERINGSKNAP ----
    const regler = await guild.channels.fetch(config.kanaler.regler);
    await regler.send({
      embeds: [new EmbedBuilder().setColor(FARVE).setTitle('📜 Regler for Hopdop')
        .setDescription([
          '**1.** Vis respekt. Ingen chikane, hadytringer eller trusler.',
          '**2.** Ingen spam, reklamer eller links til andre servere.',
          '**3.** Ingen NSFW, ulovligt indhold eller doxxing.',
          '**4.** Brug de rigtige kanaler til de rigtige ting.',
          '**5.** Følg staffs anvisninger. Uenig? Opret en ticket.',
          '**6.** Snyd og bugmisbrug i spillet medfører straf.',
          '',
          'Tryk på knappen nedenfor for at acceptere reglerne og få adgang til resten af serveren.',
        ].join('\n'))],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify').setLabel('Jeg accepterer reglerne').setEmoji('✅').setStyle(ButtonStyle.Success))],
    });

    // ---- TICKET-PANEL ----
    const ticket = await guild.channels.fetch(config.kanaler.ticket);
    await ticket.send({
      embeds: [new EmbedBuilder().setColor(FARVE).setTitle('🎫 Support')
        .setDescription('Har du brug for hjælp? Vælg en kategori nedenfor, så opretter jeg en privat kanal til dig og staff.')],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:support').setLabel('Support').setEmoji('🛟').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket:koeb').setLabel('Køb / Ranks').setEmoji('💳').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket:ansoeg').setLabel('Ansøgning').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket:fejl').setLabel('Anmeld spiller').setEmoji('🚨').setStyle(ButtonStyle.Danger))],
    });

    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('\nFærdig! config.json er gemt. Kør nu: node index.js');
  } catch (e) {
    console.error('FEJL:', e);
  }
  client.destroy();
});

client.login(process.env.TOKEN);
