// HOPDOP Discord bot - kør med: node index.js
// (c) 2026 Krainer2
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const FARVE = 0x3b82f6;
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const STAFF = ['Ejer', 'Admin', 'Mod', 'Hjælper'].map(n => config.roller[n]);
const SERVER_IP = process.env.SERVER_IP || 'hopdop.superawesome.dk';
const IP_NOTE = 'Da vi ikke har VIP, kan du ikke connecte direkte til Hopdop. Join med IP\'en ovenfor, og følg instrukserne, der kommer i chatten.';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const giveaways = new Map(); // beskedId -> Set(brugerId)
const forslagCd = new Map(); // brugerId -> tidspunkt
const FORSLAG_FIL = 'forslag.json';
const hentForslag = () => { try { return JSON.parse(fs.readFileSync(FORSLAG_FIL, 'utf8')); } catch { return {}; } };
const gemForslag = d => fs.writeFileSync(FORSLAG_FIL, JSON.stringify(d, null, 2));
const lavSid = () => Math.random().toString(36).slice(2, 10);
const dato = () => new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const erStaff = m => m.roles.cache.some(r => STAFF.includes(r.id));
const TYPER = { support: ['Support', '🛟'], koeb: ['Køb', '💳'], ansoeg: ['Ansøgning', '📝'], fejl: ['Anmeldelse', '🚨'] };

const kommandoer = [
  new SlashCommandBuilder().setName('ip').setDescription('Vis serverens IP-adresse'),
  new SlashCommandBuilder().setName('giveaway').setDescription('Start en giveaway')
    .addStringOption(o => o.setName('praemie').setDescription('Hvad kan man vinde?').setRequired(true))
    .addIntegerOption(o => o.setName('minutter').setDescription('Hvor mange minutter?').setRequired(true).setMinValue(1).setMaxValue(10080))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('forslag').setDescription('Send et forslag til serveren'),
  new SlashCommandBuilder().setName('godkend').setDescription('Godkend et forslag')
    .addStringOption(o => o.setName('sid').setDescription('Forslagets sID (står i bunden af forslaget)').setRequired(true))
    .addStringOption(o => o.setName('svar').setDescription('Valgfri begrundelse'))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('afvis').setDescription('Afvis et forslag')
    .addStringOption(o => o.setName('sid').setDescription('Forslagets sID').setRequired(true))
    .addStringOption(o => o.setName('svar').setDescription('Valgfri begrundelse'))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('say').setDescription('Send en pæn besked som botten')
    .addStringOption(o => o.setName('titel').setDescription('Titel').setRequired(true))
    .addStringOption(o => o.setName('tekst').setDescription('Tekst').setRequired(true))
    .setDefaultMemberPermissions(P.ManageMessages),
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log('Online som', client.user.tag);
  client.user.setPresence({ activities: [{ name: 'Hopdop', type: ActivityType.Playing }], status: 'online' });
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.commands.set(kommandoer);
  console.log('Kommandoer registreret.');
  await opdaterIpKanal(guild).catch(e => console.error('Kunne ikke opdatere #server-ip:', e.message));
});

// Skriver (eller retter) IP-beskeden i #server-ip, hver gang botten starter
async function opdaterIpKanal(guild) {
  const kanal = await guild.channels.fetch(config.kanaler.serverip).catch(() => null);
  if (!kanal) return console.log('#server-ip findes ikke.');
  const embed = new EmbedBuilder().setColor(FARVE).setTitle('🌐 Server-IP')
    .setDescription([
      `**IP:** \`${SERVER_IP}\``,
      '**Version:** 1.8.9',
      '',
      '**Sådan joiner du:**',
      '**1.** Åbn Minecraft, og gå til **Multiplayer**.',
      '**2.** Tryk på **Tilføj server**, og skriv IP\'en ovenfor.',
      '**3.** Join serveren, og følg instrukserne i chatten.',
      '',
      `⚠️ ${IP_NOTE}`,
    ].join('\n'))
    .setFooter({ text: 'Du kan altid skrive /ip i #bot-kommandoer' });
  const beskeder = await kanal.messages.fetch({ limit: 20 });
  const gammel = beskeder.find(m => m.author.id === client.user.id);
  if (gammel) await gammel.edit({ content: '', embeds: [embed] });
  else await kanal.send({ embeds: [embed] });
  console.log('#server-ip er opdateret.');
}

// Velkomstbesked
client.on('guildMemberAdd', async member => {
  const ch = member.guild.channels.cache.get(config.kanaler.velkommen);
  if (!ch) return;
  ch.send({ content: `${member}`, embeds: [new EmbedBuilder().setColor(FARVE)
    .setTitle('👋 Velkommen til Hopdop!')
    .setDescription(`Hej ${member}, vi er glade for at have dig her!\nLæs <#${config.kanaler.regler}> og tryk på knappen for at få adgang.\nDu er medlem nr. **${member.guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL())] }).catch(() => {});
});

client.on('interactionCreate', async i => {
  try {
    // ---------- FORSLAG: MODAL ----------
    if (i.isModalSubmit() && i.customId === 'forslag_modal') {
      const ign = i.fields.getTextInputValue('ign').trim();
      const tekst = i.fields.getTextInputValue('tekst').trim();
      const sid = lavSid();
      const kanal = i.guild.channels.cache.get(config.kanaler.forslag);
      if (!kanal) return i.reply({ content: 'Forslagskanalen findes ikke.', flags: MessageFlags.Ephemeral });
      const msg = await kanal.send({ embeds: [new EmbedBuilder().setColor(FARVE).setTitle('Nyt forslag!')
        .addFields(
          { name: 'Indsender', value: `${i.user.username} \`[${i.user.id}]\`` },
          { name: 'Ingame navn', value: ign },
          { name: 'Forslag', value: tekst.slice(0, 1000) })
        .setFooter({ text: `Bruger-ID: ${i.user.id} | sID: ${sid} • ${dato()}` })] });
      await msg.react('✅'); await msg.react('❌');
      const d = hentForslag(); d[sid] = { msg: msg.id, user: i.user.id, ign, tekst }; gemForslag(d);
      forslagCd.set(i.user.id, Date.now());
      return i.reply({ content: `✅ Dit forslag er sendt til ${kanal}. (sID: \`${sid}\`)`, flags: MessageFlags.Ephemeral });
    }

    // ---------- KOMMANDOER ----------
    if (i.isChatInputCommand()) {
      if (i.commandName === 'forslag') {
        const venter = 60000 - (Date.now() - (forslagCd.get(i.user.id) || 0));
        if (venter > 0) return i.reply({ content: `Vent ${Math.ceil(venter / 1000)} sekunder før dit næste forslag.`, flags: MessageFlags.Ephemeral });
        return i.showModal(new ModalBuilder().setCustomId('forslag_modal').setTitle('Nyt forslag').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('Dit ingame navn').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tekst').setLabel('Dit forslag').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000))));
      }
      if (i.commandName === 'godkend' || i.commandName === 'afvis') {
        const ok = i.commandName === 'godkend';
        const sid = i.options.getString('sid').trim();
        const svar = i.options.getString('svar');
        const d = hentForslag();
        const f = d[sid];
        if (!f) return i.reply({ content: 'Fandt ikke et forslag med det sID.', flags: MessageFlags.Ephemeral });
        const kanal = i.guild.channels.cache.get(config.kanaler.forslag);
        const msg = await kanal.messages.fetch(f.msg).catch(() => null);
        if (!msg) return i.reply({ content: 'Forslagsbeskeden er slettet.', flags: MessageFlags.Ephemeral });
        const emb = EmbedBuilder.from(msg.embeds[0]).setColor(ok ? 0x22c55e : 0xef4444)
          .setTitle(ok ? '✅ Forslag godkendt' : '❌ Forslag afvist')
          .addFields({ name: `${ok ? 'Godkendt' : 'Afvist'} af ${i.user.username}`, value: svar || 'Ingen begrundelse.' });
        await msg.edit({ embeds: [emb] });
        f.status = ok ? 'godkendt' : 'afvist'; gemForslag(d);
        const bruger = await client.users.fetch(f.user).catch(() => null);
        if (bruger) bruger.send(`Dit forslag er blevet **${ok ? 'godkendt' : 'afvist'}**: "${f.tekst.slice(0, 200)}"${svar ? `\nBegrundelse: ${svar}` : ''}`).catch(() => {});
        return i.reply({ content: `Forslag \`${sid}\` er ${ok ? 'godkendt' : 'afvist'}.`, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'ip') {
        return i.reply({ embeds: [new EmbedBuilder().setColor(FARVE).setTitle('🌐 Serverens IP').setDescription(`\`${SERVER_IP}\`\n\n⚠️ ${IP_NOTE}`)] });
      }
      if (i.commandName === 'say') {
        await i.channel.send({ embeds: [new EmbedBuilder().setColor(FARVE).setTitle(i.options.getString('titel')).setDescription(i.options.getString('tekst').replace(/\\n/g, '\n'))] });
        return i.reply({ content: 'Sendt.', flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'giveaway') {
        const praemie = i.options.getString('praemie');
        const min = i.options.getInteger('minutter');
        const slut = Math.floor((Date.now() + min * 60000) / 1000);
        const kanal = i.guild.channels.cache.get(config.kanaler.giveaways) || i.channel;
        const msg = await kanal.send({
          embeds: [new EmbedBuilder().setColor(FARVE).setTitle('🎁 GIVEAWAY').setDescription(`**${praemie}**\n\nSlutter <t:${slut}:R>\nStartet af ${i.user}\nDeltagere: **0**`)],
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw').setLabel('Deltag').setEmoji('🎉').setStyle(ButtonStyle.Primary))],
        });
        giveaways.set(msg.id, new Set());
        setTimeout(async () => {
          const deltagere = [...(giveaways.get(msg.id) || [])];
          giveaways.delete(msg.id);
          const vinder = deltagere.length ? deltagere[Math.floor(Math.random() * deltagere.length)] : null;
          await msg.edit({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('🎁 GIVEAWAY SLUT')
            .setDescription(`**${praemie}**\n\nVinder: ${vinder ? `<@${vinder}>` : 'ingen deltog'}\nDeltagere: **${deltagere.length}**`)], components: [] }).catch(() => {});
          await kanal.send(vinder ? `🎉 Tillykke <@${vinder}>! Du vandt **${praemie}**. Opret en ticket for at hente den.` : 'Ingen deltog i giveaway.').catch(() => {});
        }, min * 60000);
        return i.reply({ content: `Giveaway startet i ${kanal}.`, flags: MessageFlags.Ephemeral });
      }
    }

    if (!i.isButton()) return;

    // ---------- GIVEAWAY ----------
    if (i.customId === 'gw') {
      const s = giveaways.get(i.message.id);
      if (!s) return i.reply({ content: 'Giveaway er slut.', flags: MessageFlags.Ephemeral });
      if (s.has(i.user.id)) { s.delete(i.user.id); await i.reply({ content: 'Du er meldt fra.', flags: MessageFlags.Ephemeral }); }
      else { s.add(i.user.id); await i.reply({ content: 'Du er med! 🎉', flags: MessageFlags.Ephemeral }); }
      const emb = EmbedBuilder.from(i.message.embeds[0]);
      emb.setDescription(i.message.embeds[0].description.replace(/Deltagere: \*\*\d+\*\*/, `Deltagere: **${s.size}**`));
      return i.message.edit({ embeds: [emb] }).catch(() => {});
    }

    // ---------- VERIFICERING ----------
    if (i.customId === 'verify') {
      const rolle = config.roller['Spiller'];
      if (i.member.roles.cache.has(rolle)) return i.reply({ content: 'Du har allerede adgang.', flags: MessageFlags.Ephemeral });
      await i.member.roles.add(rolle);
      return i.reply({ content: '✅ Velkommen! Du har nu adgang til serveren.', flags: MessageFlags.Ephemeral });
    }

    // ---------- TICKETS ----------
    if (i.customId.startsWith('ticket:')) {
      const type = i.customId.split(':')[1];
      const [navn, emoji] = TYPER[type];
      const eksisterende = i.guild.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
      if (eksisterende) return i.reply({ content: `Du har allerede en åben ticket: ${eksisterende}`, flags: MessageFlags.Ephemeral });
      const kanal = await i.guild.channels.create({
        name: `${emoji}┃${i.user.username}`.slice(0, 90),
        type: ChannelType.GuildText,
        parent: config.kanaler.support,
        topic: `ticket:${i.user.id}`,
        permissionOverwrites: [
          { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
          { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
          ...STAFF.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages] })),
        ],
      });
      await kanal.send({
        content: `${i.user} ${STAFF.slice(0, 4).map(id => `<@&${id}>`).join(' ')}`,
        embeds: [new EmbedBuilder().setColor(FARVE).setTitle(`${emoji} ${navn}`)
          .setDescription('Beskriv dit problem så detaljeret som muligt, så hjælper en fra staff dig snarest.\nNår I er færdige, tryk på knappen for at lukke ticketten.')],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_luk').setLabel('Luk ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger))],
      });
      return i.reply({ content: `Din ticket er oprettet: ${kanal}`, flags: MessageFlags.Ephemeral });
    }

    if (i.customId === 'ticket_luk') {
      const ejerId = (i.channel.topic || '').replace('ticket:', '');
      if (!erStaff(i.member) && i.user.id !== ejerId) return i.reply({ content: 'Kun staff eller ticket-ejeren kan lukke.', flags: MessageFlags.Ephemeral });
      await i.reply('🔒 Ticketten lukkes om 5 sekunder...');
      const log = i.guild.channels.cache.get(config.kanaler.ticketlog);
      if (log) log.send({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('📁 Ticket lukket')
        .setDescription(`Kanal: **${i.channel.name}**\nEjer: <@${ejerId}>\nLukket af: ${i.user}`)] }).catch(() => {});
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
  } catch (e) {
    console.error('Fejl:', e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: 'Der skete en fejl.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
