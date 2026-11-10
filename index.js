// HOPDOP Discord bot - kør med: node index.js
// (c) 2026 Krainer2
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, escapeMarkdown, Partials } = require('discord.js');

const FARVE = 0x3b82f6;
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const STAFF = ['Ejer', 'Admin', 'Mod', 'Hjælper'].map(n => config.roller[n]);
const SERVER_IP = process.env.SERVER_IP || 'hopdop.superawesome.dk';
const IP_NOTE = 'Da vi ikke har VIP, kan du ikke connecte direkte til Hopdop. Join med IP\'en ovenfor, og følg instrukserne, der kommer i chatten.';

// Tjekker om "Message Content Intent" er slået til i Developer Portal (ellers ville botten ikke kunne logge ind)
const MESSAGE_CONTENT = (() => {
  try {
    const kode = "fetch('https://discord.com/api/v10/applications/@me',{headers:{Authorization:'Bot '+process.env.TOKEN}}).then(r=>r.json()).then(d=>console.log(d.flags||0)).catch(()=>console.log(0))";
    const flags = Number(require('child_process').execFileSync(process.execPath, ['-e', kode], { env: process.env, timeout: 15000 }).toString().trim()) || 0;
    return (flags & ((1 << 18) | (1 << 19))) !== 0;
  } catch { return false; }
})();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildVoiceStates, ...(MESSAGE_CONTENT ? [GatewayIntentBits.MessageContent] : [])],
  partials: [Partials.Message, Partials.Reaction, Partials.User] });
const giveaways = new Map(); // beskedId -> Set(brugerId)
// Giveaways gemmes i giveaways.json, så de overlever en genstart
const GW_FIL = 'giveaways.json';
const gwData = (() => { try { return JSON.parse(fs.readFileSync(GW_FIL, 'utf8')); } catch { return {}; } })();
const gemGw = () => { for (const [id, set] of giveaways) if (gwData[id]) gwData[id].deltagere = [...set]; fs.writeFileSync(GW_FIL, JSON.stringify(gwData, null, 2)); };

function planlaegGiveaway(msgId) {
  const g = gwData[msgId];
  giveaways.set(msgId, new Set(g.deltagere || []));
  setTimeout(() => afslutGiveaway(msgId), Math.max(1000, g.slut * 1000 - Date.now()));
}
const GW_SLUT_FIL = 'giveaways-slut.json'; // afsluttede giveaways (til "træk ny vinder")
const gwSlut = (() => { try { return JSON.parse(fs.readFileSync(GW_SLUT_FIL, 'utf8')); } catch { return {}; } })();
const gemGwSlut = () => { const ids = Object.keys(gwSlut); for (const id of ids.slice(0, -30)) delete gwSlut[id]; fs.writeFileSync(GW_SLUT_FIL, JSON.stringify(gwSlut)); };
const traek = (liste, n) => { const kopi = [...liste], ud = []; while (kopi.length && ud.length < n) ud.push(kopi.splice(Math.floor(Math.random() * kopi.length), 1)[0]); return ud; };

function gwEmbed(g, antal) {
  return new EmbedBuilder().setColor(0xaa00aa).setAuthor({ name: 'HOPDOP · Giveaway' })
    .setTitle(`🎁 ${g.praemie}`)
    .setDescription([
      `Tryk på **🎉 Deltag** for at være med!`, '',
      `⏰ Slutter: <t:${g.slut}:R> (<t:${g.slut}:t>)`,
      `🏆 Vindere: **${g.vindere || 1}**`,
      `👥 Deltagere: **${antal}**`,
      `🎙️ Startet af: <@${g.af}>`,
    ].join('\n'));
}

// Sender vinder-besked i kanalen (alle kan se den) + DM til hver vinder
async function udraabVindere(kanal, msgId, g, vindere, nyTraekning = false) {
  const link = `https://discord.com/channels/${kanal.guildId}/${kanal.id}/${msgId}`;
  if (!vindere.length) return kanal.send({ embeds: [new EmbedBuilder().setColor(0x64748b)
    .setTitle(`🎁 ${g.praemie}`).setDescription('Ingen deltog i giveawayen, så der er ingen vinder denne gang.')] }).catch(() => {});
  const tags = vindere.map(v => `<@${v}>`).join(' ');
  await kanal.send({
    content: `🎉 ${tags}`,
    embeds: [new EmbedBuilder().setColor(0x22c55e).setAuthor({ name: nyTraekning ? 'HOPDOP · Ny vinder trukket' : 'HOPDOP · Giveaway slut' })
      .setTitle(`🏆 ${vindere.length > 1 ? 'Vinderne' : 'Vinderen'} af ${g.praemie}`)
      .setDescription(`Tillykke til ${tags}! 🎉\n\nTjek dine DM'er. Der står, hvordan du får din præmie.\n[Gå til giveawayen](${link})`)],
    allowedMentions: { users: vindere },
  }).catch(() => {});
  const ticket = config.kanaler.ticket ? `<#${config.kanaler.ticket}>` : '#opret-ticket';
  for (const v of vindere) {
    const u = await client.users.fetch(v).catch(() => null);
    if (!u) continue;
    await u.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setAuthor({ name: 'HOPDOP · Du har vundet!' })
      .setTitle(`🎉 Tillykke! Du vandt ${g.praemie}`)
      .setDescription([
        `Du har vundet **${g.praemie}** i en giveaway på HOPDOP-Discorden!`, '',
        '**Sådan får du din præmie:**',
        `**1.** Opret en ticket i ${ticket} og vælg **Support**.`,
        `**2.** Skriv, at du har vundet **${g.praemie}**, og hvad du hedder ingame.`,
        `**3.** Du kan også skrive direkte til <@${g.af}>, som startede giveawayen.`, '',
        '⏳ Hent præmien inden for 7 dage, ellers kan den blive givet videre.',
        `[Se giveawayen](${link})`,
      ].join('\n'))] }).catch(() => kanal.send(`<@${v}> Jeg kunne ikke sende dig en DM. Opret en ticket for at få din præmie. 🎁`).catch(() => {}));
  }
}

async function afslutGiveaway(msgId) {
  const g = gwData[msgId];
  if (!g) return;
  const deltagere = [...(giveaways.get(msgId) || [])];
  giveaways.delete(msgId); delete gwData[msgId]; gemGw();
  const kanal = await client.channels.fetch(g.kanal).catch(() => null);
  if (!kanal) return;
  const msg = await kanal.messages.fetch(msgId).catch(() => null);
  const vindere = traek(deltagere, g.vindere || 1);
  gwSlut[msgId] = { ...g, deltagere, vundet: vindere }; gemGwSlut();
  if (msg) await msg.edit({
    embeds: [new EmbedBuilder().setColor(0x64748b).setAuthor({ name: 'HOPDOP · Giveaway slut' }).setTitle(`🎁 ${g.praemie}`)
      .setDescription(`🏆 ${vindere.length ? `Vinder: ${vindere.map(v => `<@${v}>`).join(', ')}` : 'Ingen deltog'}\n👥 Deltagere: **${deltagere.length}**\n🎙️ Startet af: <@${g.af}>\n⏰ Sluttede <t:${g.slut}:R>`)],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw_reroll').setLabel('Træk ny vinder (staff)').setEmoji('🔁').setStyle(ButtonStyle.Secondary))],
  }).catch(() => {});
  await udraabVindere(kanal, msgId, g, vindere);
}

// Finder giveaways, som botten har glemt (fx startet før en opdatering), og får dem til at slutte rigtigt
async function findGlemteGiveaways() {
  const kanal = await client.channels.fetch(config.kanaler.giveaways).catch(() => null);
  if (!kanal) return;
  const beskeder = await kanal.messages.fetch({ limit: 50 }).catch(() => null);
  if (!beskeder) return;
  for (const m of beskeder.values()) {
    if (m.author.id !== client.user.id || gwData[m.id]) continue;
    if (!m.components.some(r => r.components.some(c => c.customId === 'gw'))) continue;
    const e = m.embeds[0]; if (!e) continue;
    const slut = Number(((e.description || '').match(/<t:(\d+):R>/) || [])[1]);
    const praemie = ((e.description || '').match(/^\*\*(.+?)\*\*/) || [])[1] || (e.title || '').replace(/^🎁\s*/, '') || 'Præmie';
    const af = ((e.description || '').match(/<@!?(\d+)>/) || [])[1] || client.user.id;
    if (!slut) continue;
    gwData[m.id] = { kanal: kanal.id, praemie, slut, af, vindere: 1, deltagere: [] };
    console.log(`Fandt glemt giveaway: ${praemie}`);
    planlaegGiveaway(m.id);
  }
  gemGw();
}

const forslagCd = new Map(); // brugerId -> tidspunkt
const FORSLAG_FIL = 'forslag.json';
const hentForslag = () => { try { return JSON.parse(fs.readFileSync(FORSLAG_FIL, 'utf8')); } catch { return {}; } };
const gemForslag = d => fs.writeFileSync(FORSLAG_FIL, JSON.stringify(d, null, 2));
const lavSid = () => Math.random().toString(36).slice(2, 10);
const dato = () => new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---------- DATA FRA HJEMMESIDEN (samme stats som ingame, synkes hvert 5. min) ----------
const WEB = (process.env.WEB_URL || 'https://hopdop.pages.dev').replace(/\/+$/, '');
const webCache = {};
async function hentWeb(sti) {
  const c = webCache[sti];
  if (c && Date.now() - c.t < 60000) return c.d;
  const r = await fetch(`${WEB}/api/${sti}`);
  if (!r.ok) throw new Error(`Hjemmesiden svarede ${r.status}`);
  const d = await r.json();
  webCache[sti] = { t: Date.now(), d };
  return d;
}
const tal = (n, dec = 0) => Number(n || 0).toLocaleString('da-DK', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Bygger samme stats som ingame /stats (Stats-Duels.sk): Status, Team, Kills, Døde, K/D,
// samlet placering (gennemsnit af plads på kills, K/D og daily), leaderboards, daily-streak og duels.
const LILLA = 0xaa00aa; // &5 i Minecraft
const kdTal = s => s.d ? Math.round(s.k / s.d * 100) / 100 : s.k; // som pfKD ingame
const VAL = { kills: s => s.k, kd: kdTal, daily: s => s.ds, doede: s => s.d };
const rank = (alle, s, fn) => alle.filter(x => fn(x) > fn(s)).length + 1; // som pfRank ingame

// Spillerens rigtige skin - samme vej som hjemmesiden (/api/hoved kender skinnet fra serveren)
const skinCache = {};
async function skinUrl(u, navn, type = 'body') {
  const id = u.replace(/-/g, '').toLowerCase();
  if (id[12] === '3') return `https://mc-heads.net/${type}/${encodeURIComponent(navn)}/128`; // offline-konto: brug navnet
  const k = type + id;
  if (skinCache[k] && Date.now() - skinCache[k].t < 3600000) return skinCache[k].url;
  let url = `${WEB}/api/hoved?u=${id}&s=128${type === 'body' ? '&t=body' : ''}`;
  try {
    const r = await fetch(url, { redirect: 'manual' });
    const hvor = r.headers.get('location');
    if (hvor && hvor.startsWith('http')) url = hvor;
  } catch { /* brug hjemmesidens adresse direkte */ }
  skinCache[k] = { url, t: Date.now() };
  return url;
}

async function lavStatsEmbed(navn) {
  const stats = await hentWeb('stats');
  const alle = stats.spillere;
  const s = alle.find(x => x.n.toLowerCase() === navn.toLowerCase());
  if (!s) return null;
  const duel = await hentWeb('duel').catch(() => ({ kits: [], spillere: [] }));
  const online = (stats.online || []).some(n => n.toLowerCase() === s.n.toLowerCase());
  const team = (stats.teams || []).find(t => t.m.some(m => m.u === s.u));
  const nr = n => ` \`#${n}\``;

  // Samlet placering præcis som pfSamlet ingame
  const score = x => (rank(alle, x, VAL.kills) + rank(alle, x, VAL.kd) + rank(alle, x, VAL.daily)) / 3;
  const min = score(s);
  const samlet = alle.filter(x => x.u !== s.u && score(x) < min).length + 1;

  const emb = new EmbedBuilder().setColor(LILLA)
    .setAuthor({ name: 'HOPDOP · Spillerstats' })
    .setTitle(s.n)
    .setURL(`${WEB}/spiller.html?navn=${encodeURIComponent(s.n)}`)
    .setThumbnail(await skinUrl(s.u, s.n))
    .setDescription([
      `${online ? '🟢 **Online**' : '🔴 Offline'}  ·  🛡️ ${team ? `Team **${team.n}**` : 'Intet team'}`,
      `🏆 Samlet placering: **#${samlet}** af ${tal(alle.length)}`,
    ].join('\n'))
    .addFields(
      { name: '⚔️ PvP', inline: true, value:
        `**${tal(s.k)}** kills${nr(rank(alle, s, VAL.kills))}\n**${tal(s.d)}** døde\n**${String(kdTal(s)).replace('.', ',')}** K/D${nr(rank(alle, s, VAL.kd))}` },
      { name: '📅 Daily', inline: true, value: `**${tal(s.ds)}** dage i træk${nr(rank(alle, s, VAL.daily))}` },
    );

  const ds = (duel.spillere || []).find(x => x.u === s.u);
  if (ds) {
    const wr = ds.s + ds.t > 0 ? Math.round(ds.s / (ds.s + ds.t) * 100) : 0;
    emb.addFields({ name: '🥊 Duels', inline: true, value:
      `**${tal(ds.elo)}** rating${nr(rank(duel.spillere, ds, x => x.elo))}\n**${tal(ds.s)}**W / **${tal(ds.t)}**L\n**${wr}%** win rate` });
    const kits = (duel.kits || []).map(k => ({ n: k.n, x: ds.ks && ds.ks[k.id] })).filter(o => o.x && (o.x.s + o.x.t))
      .sort((a, b) => (b.x.s + b.x.t) - (a.x.s + a.x.t)).slice(0, 6)
      .map(o => `**${o.n}** ${tal(o.x.s)}W/${tal(o.x.t)}L`);
    if (kits.length) emb.addFields({ name: '🗡️ Duel-kits', value: kits.join('  ·  ') });
  } else {
    emb.addFields({ name: '🥊 Duels', inline: true, value: 'Ingen dueller endnu' });
  }

  const minSiden = stats.opdateret ? Math.max(0, Math.round((Date.now() - stats.opdateret) / 60000)) : null;
  emb.setFooter({ text: `${minSiden === null ? '' : `Opdateret for ${minSiden} min. siden · `}Klik på navnet for hele profilen` });
  return emb;
}

// ---------- ANSØGNINGER OG STRAFFE FRA HJEMMESIDEN ----------
// Kræver BOT_NOEGLE i .env (samme nøgle som BOT_NOEGLE i Cloudflare). Nøglen kan kun LÆSE.
const botNoegle = () => { require('dotenv').config({ override: true, quiet: true }); return process.env.BOT_NOEGLE || ''; };
const SET_FIL = 'web-set.json'; // hvilke ansøgninger/straffe der allerede er postet
async function hentPrivat(sti) {
  const r = await fetch(`${WEB}/api/${sti}`, { headers: { Authorization: `Bot ${botNoegle()}` } });
  if (!r.ok) throw new Error(`/api/${sti} svarede ${r.status}`);
  return r.json();
}
async function postPrivat(sti, body) {
  const r = await fetch(`${WEB}/api/${sti}`, { method: 'POST', headers: { Authorization: `Bot ${botNoegle()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`POST /api/${sti} svarede ${r.status}`);
  return r.json();
}
let etiketter = null; // spørgsmålenes tekster fra ansog-skema.js
async function hentEtiketter() {
  if (etiketter) return etiketter;
  try {
    const js = await (await fetch(`${WEB}/ansog-skema.js`)).text();
    etiketter = {};
    let type = '';
    for (const linje of js.split('\n')) {
      const t = linje.match(/^\s{2}([a-z]+):\s*\{/); if (t) type = t[1];
      const m = linje.match(/id:\s*'([a-z0-9_]+)',\s*label:\s*'((?:[^'\\]|\\.)*)'/);
      if (m) etiketter[`${type}:${m[1]}`] = m[2].replace(/\\'/g, "'");
    }
  } catch { etiketter = {}; }
  return etiketter;
}
const ANS_TYPE = { staff: ['Staff', '🛡️'], bygger: ['Bygger', '🧱'], unban: ['Unban', '🔓'] };
const STRAF_FARVE = { BAN: 0xef4444, MUTE: 0xf59e0b, KICK: 0x3b82f6, WARN: 0xeab308 };

async function tjekHjemmeside() {
  if (!botNoegle()) return;
  let set; try { set = JSON.parse(fs.readFileSync(SET_FIL, 'utf8')); } catch { set = null; }
  const foerste = !set;
  set = set || { ansog: [], straffe: [] };

  // Ansøgninger -> #staff-chat
  try {
    const { ansogninger = [] } = await hentPrivat('ansog');
    const kanal = await client.channels.fetch(config.kanaler.ansogsvar || config.kanaler.staffchat).catch(() => null);
    const nye = ansogninger.filter(a => !set.ansog.includes(a.id)).reverse();
    const lbl = await hentEtiketter();
    for (const a of nye) {
      set.ansog.push(a.id);
      if (foerste || !kanal || a.status !== 'ny') continue;
      const [navn, ikon] = ANS_TYPE[a.type] || [a.type, '📝'];
      const emb = new EmbedBuilder().setColor(LILLA).setAuthor({ name: 'HOPDOP · Ny ansøgning' })
        .setTitle(`${ikon} ${navn}: ${a.felter.mcnavn || 'ukendt'}`).setURL(`${WEB}/admin.html`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(a.felter.mcnavn || 'MHF_Steve')}/64`)
        .setTimestamp(a.oprettet || Date.now()).setFooter({ text: 'Behandl ansøgningen i admin-panelet på hjemmesiden' });
      let i = 0;
      for (const [k, v] of Object.entries(a.felter)) {
        if (!v || i++ >= 20) continue;
        emb.addFields({ name: (lbl[`${a.type}:${k}`] || k).slice(0, 250), value: String(v).slice(0, 700), inline: String(v).length < 40 });
      }
      await kanal.send({ embeds: [emb] }).catch(e => console.error('Ansøgning:', e.message));
    }
  } catch (e) { console.error('Ansøgninger fra hjemmesiden:', e.message); }

  // Straffe -> #straf-log
  try {
    const { poster = [] } = await hentPrivat('straffe');
    const kanal = await client.channels.fetch(config.kanaler.straflog).catch(() => null);
    const nye = poster.filter(p => !String(p.id).startsWith('aktiv-') && !set.straffe.includes(p.id)).reverse();
    for (const p of nye) {
      set.straffe.push(p.id);
      if (foerste || !kanal) continue;
      const emb = new EmbedBuilder().setColor(STRAF_FARVE[p.type] || 0x22c55e)
        .setAuthor({ name: 'HOPDOP · Straf-log' })
        .setTitle(`${p.type.startsWith('UN') ? '✅' : '⚖️'} ${p.type}: ${p.n}`)
        .setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(p.n)}/64`)
        .addFields(
          { name: 'Grund', value: String(p.grund || (p.type.startsWith('UN') ? 'Ophævet' : '-')).slice(0, 1000) },
          { name: 'Af', value: String(p.af || 'Ukendt'), inline: true },
          { name: 'Varighed', value: String(p.varighed || (p.til === -1 ? 'Permanent' : '-')), inline: true })
        .setTimestamp(p.tid || Date.now());
      await kanal.send({ embeds: [emb] }).catch(e => console.error('Straf:', e.message));
      if (!p.type.startsWith('UN')) {
        const antal = poster.filter(x => String(x.n).toLowerCase() === String(p.n).toLowerCase() && !String(x.type).startsWith('UN') && !String(x.id).startsWith('aktiv-') && x.tid > Date.now() - 30 * 86400000).length;
        if (antal >= 3) mistanke('Gengænger', `**${escapeMarkdown(String(p.n))}** har fået **${antal} straffe de seneste 30 dage**. Seneste: ${p.type} (${String(p.grund || 'ingen grund').slice(0, 100)}).`, 0xf59e0b);
      }
    }
  } catch (e) { console.error('Straffe fra hjemmesiden:', e.message); }

  set.ansog = set.ansog.slice(-3000); set.straffe = set.straffe.slice(-5000);
  fs.writeFileSync(SET_FIL, JSON.stringify(set));
  if (foerste) console.log('Hjemmeside-forbindelse klar. Nye ansøgninger og straffe postes fra nu af.');
}

// ---------- /link: Discord <-> Minecraft og rank-roller ----------
// Spilleren skriver /link her og /discord <kode> ingame (DiscordLink.sk). Ranks kommer via hjemmesiden.
const LINK_FIL = 'link.json';
const linkData = (() => { try { return JSON.parse(fs.readFileSync(LINK_FIL, 'utf8')); } catch { return { ventende: {}, links: {} }; } })();
const gemLink = () => fs.writeFileSync(LINK_FIL, JSON.stringify(linkData, null, 2));
const KODE_TEGN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nyLinkKode = () => Array.from({ length: 6 }, () => KODE_TEGN[Math.floor(Math.random() * KODE_TEGN.length)]).join('');
// Køberanks: kun den højeste gives. Ekstra-roller gives hver for sig. Staff-roller synkes ALDRIG automatisk.
const KOEBERANKS = ['Legende', 'Mester', 'Diamant', 'Guld', 'Sølv', 'Bronze'];
const EKSTRA = ['Streamer', 'Partner', 'Builder', 'Event'];
const norm = t => String(t).toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace('bygger', 'builder').replace(/^solv$/, 'soelv');
const linkAf = discordId => linkData.links[discordId] || null;

async function synkRoller(guild, discordId, ranks) {
  const m = await guild.members.fetch(discordId).catch(() => null);
  if (!m) return;
  const har = new Set((ranks || []).map(norm));
  const hoejeste = KOEBERANKS.find(r => har.has(norm(r)));
  const skal = new Set([hoejeste, ...EKSTRA.filter(r => har.has(norm(r)))].filter(Boolean));
  for (const navn of [...KOEBERANKS, ...EKSTRA]) {
    const id = config.roller[navn];
    if (!id) continue;
    if (skal.has(navn) && !m.roles.cache.has(id)) await m.roles.add(id, 'Rank fra Minecraft').catch(e => console.error('Rolle:', e.message));
    if (!skal.has(navn) && m.roles.cache.has(id)) await m.roles.remove(id, 'Rank fra Minecraft').catch(e => console.error('Rolle:', e.message));
  }
}

async function tjekLinks() {
  if (!botNoegle()) return;
  try {
    const nu = Date.now();
    for (const [k, v] of Object.entries(linkData.ventende)) if (nu - v.t > 30 * 60000) delete linkData.ventende[k];
    if (!Object.keys(linkData.links).length && !Object.keys(linkData.ventende).length) return;
    const { koder = {}, ranks = {} } = await hentPrivat('link');
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    // Nye forbindelser
    for (const [kode, v] of Object.entries(linkData.ventende)) {
      const k = koder[kode];
      if (!k) continue;
      // Samme Minecraft-konto må kun være forbundet med én Discord
      for (const [d, l] of Object.entries(linkData.links)) if (l.u === k.u && d !== v.d) delete linkData.links[d];
      linkData.links[v.d] = { u: k.u, n: k.n, r: '' };
      devlogDiscord(`🔗 **${k.n}** har forbundet sin Minecraft med Discord`);
      delete linkData.ventende[kode];
      console.log(`Forbundet: ${k.n} <-> ${v.d}`);
      client.users.fetch(v.d).then(u => u.send({ embeds: [new EmbedBuilder().setColor(0x22c55e)
        .setTitle('✅ Din Discord er forbundet!')
        .setDescription(`Du er nu forbundet med **${k.n}** på Hopdop.\nDin rank-rolle bliver sat automatisk, og \`/stats\` uden navn viser nu dine egne stats.`)] })).catch(() => {});
    }
    // Fortæl hjemmesiden, hvem der er forbundet (serveren giver så belønningen første gang)
    for (const l of Object.values(linkData.links)) if (!l.b) { try { await postPrivat('link', { type: 'bekraeft', u: l.u }); l.b = true; } catch (e) { console.error('Bekræft link:', e.message); } }
    // Ranks -> roller (kun når noget har ændret sig)
    for (const [d, l] of Object.entries(linkData.links)) {
      const r = ranks[l.u];
      if (!r) continue;
      if (r.n) l.n = r.n;
      const noegle = r.r.slice().sort().join(',');
      if (noegle === l.r) continue;
      await synkRoller(guild, d, r.r);
      l.r = noegle;
    }
    gemLink();
  } catch (e) { console.error('Link:', e.message); }
}

// ---------- Hjælper: find/opret en læs-kanal, som kun botten og staff skriver i ----------
async function sikrKanal(guild, noegle, navn, emne, foraelderKanal) {
  let k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
  if (k) return k;
  const parent = (await guild.channels.fetch(foraelderKanal).catch(() => null))?.parentId;
  k = await guild.channels.create({
    name: navn, type: ChannelType.GuildText, parent: parent || undefined, topic: emne,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: config.roller['Spiller'], allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] },
      ...STAFF.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] })),
    ],
  });
  config.kanaler[noegle] = k.id;
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  console.log(`#${navn} er oprettet.`);
  return k;
}
async function bottensBesked(kanal) {
  const b = await kanal.messages.fetch({ limit: 20 }).catch(() => null);
  return b ? b.filter(m => m.author.id === client.user.id).last() : null; // ældste besked fra botten
}

// ---------- LIVE #leaderboards (opdateres hvert 5. min) ----------
const LB_LISTER = ['samlet', 'kills', 'kd', 'daily', 'rating', 'koth'];
let lbBesked = null;
async function opdaterLeaderboards() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const kanal = await sikrKanal(guild, 'leaderboards', '🏆┃leaderboards', 'Top 10 på Hopdop - opdateres af sig selv hvert 5. minut', config.kanaler.chat);
    const embeds = [];
    for (const id of LB_LISTER) embeds.push(await lavTopEmbed(id, true));
    embeds[embeds.length - 1].setFooter({ text: 'Opdateres af sig selv hvert 5. minut · Se alle lister på hjemmesiden' }).setTimestamp();
    const indhold = { content: '## 🏆 HOPDOP Leaderboards\nSe dine egne stats med `/stats` i #bot-kommandoer.', embeds };
    if (!lbBesked) lbBesked = await bottensBesked(kanal);
    lbBesked = lbBesked ? await lbBesked.edit(indhold) : await kanal.send(indhold);
  } catch (e) { console.error('Leaderboards:', e.message); }
}

// ---------- #server-status (grøn = oppe, rød = nede) ----------
// Serveren sender data hvert 5. minut. Kommer der intet i 12 minutter, regnes den som nede.
const STATUS_FIL = 'status.json';
let statusBesked = null;
async function opdaterServerStatus() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const kanal = await sikrKanal(guild, 'serverstatus', '🟢┃server-status', 'Er Hopdop oppe? Opdateres af sig selv', config.kanaler.velkommen);
    let st; try { st = JSON.parse(fs.readFileSync(STATUS_FIL, 'utf8')); } catch { st = { oppe: null, siden: Date.now() }; }
    let stats = null; try { stats = await hentWeb('stats'); } catch { /* hjemmesiden svarer ikke */ }
    const sidst = stats?.opdateret || 0;
    const oppe = !!sidst && Date.now() - sidst < 12 * 60000;
    const online = oppe ? (stats.online || []).length : 0;
    if (st.oppe !== null && st.oppe !== oppe) {
      const varighed = Math.max(1, Math.round((Date.now() - st.siden) / 60000));
      const tid = varighed >= 60 ? `${Math.floor(varighed / 60)} t. ${varighed % 60} min.` : `${varighed} min.`;
      await kanal.send({ embeds: [new EmbedBuilder().setColor(oppe ? 0x22c55e : 0xef4444)
        .setTitle(oppe ? '🟢 Hopdop er oppe igen!' : '🔴 Hopdop er nede')
        .setDescription(oppe ? `Serveren var nede i **${tid}**\nVelkommen tilbage! 🎉\nJoin: \`${SERVER_IP}\`` : `Vi har ikke hørt fra serveren i over 12 minutter.\nStaff kigger på det. Følg med her.`)
        .setTimestamp()] }).catch(() => {});
      st.siden = Date.now();
    }
    if (st.oppe === null) st.siden = Date.now();
    st.oppe = oppe; fs.writeFileSync(STATUS_FIL, JSON.stringify(st));
    const nytNavn = `${oppe ? '🟢' : '🔴'}┃server-status`;
    if (kanal.name !== nytNavn) await kanal.setName(nytNavn).catch(() => {}); // Discord tillader kun få navneskift, så kun ved ændring
    const emb = new EmbedBuilder().setColor(oppe ? 0x22c55e : 0xef4444)
      .setAuthor({ name: 'HOPDOP · Server-status' })
      .setTitle(oppe ? '🟢 Serveren er OPPE' : '🔴 Serveren er NEDE')
      .addFields(
        { name: oppe ? '⏱️ Oppe siden' : '⏱️ Nede siden', value: `<t:${Math.floor(st.siden / 1000)}:R>`, inline: true },
        { name: '👥 Online', value: oppe ? `**${online}** ${online === 1 ? 'spiller' : 'spillere'}` : '-', inline: true },
        { name: '📡 Sidste data', value: sidst ? `<t:${Math.floor(sidst / 1000)}:R>` : 'Aldrig', inline: true },
        { name: '🌐 IP', value: `\`${SERVER_IP}\`` })
      .setFooter({ text: 'Tjekkes hvert 2. minut · Ved nedetid kommer der en besked herunder' }).setTimestamp();
    if (!statusBesked) statusBesked = await bottensBesked(kanal);
    statusBesked = statusBesked ? await statusBesked.edit({ embeds: [emb] }) : await kanal.send({ embeds: [emb] });
  } catch (e) { console.error('Server-status:', e.message); }
}

// ---------- AUTO-MOD (Discords egen AutoMod - virker også når botten er offline) ----------
async function opsaetAutoMod(guild) {
  const findes = await guild.autoModerationRules.fetch().catch(() => null);
  if (!findes) return console.log('Kunne ikke læse AutoMod-regler (mangler botten "Administrer server"?)');
  const alarm = { type: 2, metadata: { channel: config.kanaler.straflog } };
  const regler = [
    { name: 'HOPDOP · Invites til andre Discords', triggerType: 1,
      triggerMetadata: { regexPatterns: ['(discord\\.gg|discord(app)?\\.com/invite|dsc\\.gg)/[a-zA-Z0-9-]+'] },
      actions: [{ type: 1, metadata: { customMessage: 'Reklame for andre Discord-servere er ikke tilladt på HOPDOP.' } }, alarm, { type: 3, metadata: { durationSeconds: 600 } }] },
    { name: 'HOPDOP · Massetags', triggerType: 5,
      triggerMetadata: { mentionTotalLimit: 5, mentionRaidProtectionEnabled: true },
      actions: [{ type: 1, metadata: { customMessage: 'Du tagger for mange på én gang.' } }, alarm, { type: 3, metadata: { durationSeconds: 600 } }] },
    { name: 'HOPDOP · Spam', triggerType: 3, triggerMetadata: {},
      actions: [{ type: 1, metadata: { customMessage: 'Din besked ligner spam og blev stoppet.' } }, alarm] },
    { name: 'HOPDOP · Grove ord og 18+', triggerType: 4, triggerMetadata: { presets: [2, 3] },
      actions: [{ type: 1, metadata: { customMessage: 'Hold en god tone på HOPDOP.' } }, alarm] },
  ];
  for (const r of regler) {
    if (findes.some(x => x.name === r.name)) continue;
    if (r.triggerType !== 1 && findes.some(x => x.triggerType === r.triggerType)) { console.log(`AutoMod: der findes allerede en regel af typen til "${r.name}"`); continue; }
    await guild.autoModerationRules.create({ ...r, eventType: 1, enabled: true, exemptRoles: STAFF, reason: 'HOPDOP auto-mod' })
      .then(() => { console.log('AutoMod-regel oprettet:', r.name); devlogDiscord(`🛡️ Ny auto-mod regel: **${r.name.replace('HOPDOP · ', '')}**`); })
      .catch(e => console.error('AutoMod:', r.name, e.message));
  }
}

// ---------- DEVLOG ----------
// 1) devlog.json i bot-mappen: Claude skriver opdateringer her (når du skriver /devlog i chatten). Botten poster nye.
// 2) Ændringer på Discorden (nye kanaler/roller, auto-mod, nye links) samles og postes hvert 30. min.
// 3) /devlog i Discord (kun staff): skriv selv en opdatering.
const DEVLOG_FIL = 'devlog.json', DEVLOG_POSTET = 'devlog-postet.json';
const discordAendringer = [];
function devlogDiscord(tekst) { if (!discordAendringer.includes(tekst)) discordAendringer.push(tekst); }
function devlogEmbed(titel, punkter, kategori) {
  return new EmbedBuilder().setColor(0x6366f1).setAuthor({ name: `HOPDOP · Dev-log${kategori ? ` · ${kategori}` : ''}` })
    .setTitle(`🛠️ ${titel}`)
    .setDescription(punkter.map(p => p.startsWith('•') || /^\p{Extended_Pictographic}/u.test(p) ? p : `• ${p}`).join('\n').slice(0, 4000))
    .setTimestamp();
}
async function postDevlog() {
  try {
    const kanal = await client.channels.fetch(config.kanaler.devlog).catch(() => null);
    if (!kanal) return;
    let liste = []; try { liste = JSON.parse(fs.readFileSync(DEVLOG_FIL, 'utf8')); } catch { /* ingen fil endnu */ }
    let postet = []; try { postet = JSON.parse(fs.readFileSync(DEVLOG_POSTET, 'utf8')); } catch { /* første gang */ }
    for (const d of liste) {
      if (!d.id || postet.includes(d.id)) continue;
      await sendPing(kanal, 'Dev-Log', { embeds: [devlogEmbed(d.titel || 'Opdatering', d.punkter || [], d.kategori)] });
      postet.push(d.id);
    }
    fs.writeFileSync(DEVLOG_POSTET, JSON.stringify(postet.slice(-500)));
  } catch (e) { console.error('Devlog:', e.message); }
}
async function postDiscordAendringer() {
  if (!discordAendringer.length) return;
  const kanal = await client.channels.fetch(config.kanaler.devlog).catch(() => null);
  if (!kanal) return;
  const punkter = discordAendringer.splice(0, discordAendringer.length);
  await kanal.send({ embeds: [devlogEmbed('Ændringer på Discorden', punkter, 'Discord')] }).catch(e => console.error('Devlog:', e.message));
}
// Discord-ændringer, som spillerne kan se (tickets og staff-kanaler tæller ikke med)
const erOffentlig = c => c && !String(c.topic || '').startsWith('ticket:') && c.permissionOverwrites?.cache?.get(config.roller['Spiller'])?.allow?.has(P.ViewChannel);
client.on('channelCreate', c => { if (erOffentlig(c)) devlogDiscord(`📁 Ny kanal: <#${c.id}>`); });
client.on('channelDelete', c => { if (erOffentlig(c)) devlogDiscord(`🗑️ Kanalen **#${c.name}** er fjernet`); });
client.on('roleCreate', r => { if (!r.managed) devlogDiscord(`🏷️ Ny rolle: <@&${r.id}>`); });
client.on('roleDelete', r => { if (!r.managed) devlogDiscord(`🗑️ Rollen **${r.name}** er fjernet`); });

// Svar til /link og knappen i #link (kun brugeren selv kan se det)
function linkSvar(discordId) {
  const l = linkAf(discordId);
  if (l) return { content: `✅ Du er allerede forbundet med **${l.n}**. Brug knappen **Fjern forbindelse** eller \`/unlink\` for at fjerne det.`, flags: MessageFlags.Ephemeral };
  for (const [k, v] of Object.entries(linkData.ventende)) if (v.d === discordId) delete linkData.ventende[k];
  const kode = nyLinkKode();
  linkData.ventende[kode] = { d: discordId, t: Date.now() }; gemLink();
  return { flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(LILLA)
    .setAuthor({ name: 'HOPDOP · Forbind din konto' })
    .setTitle('🔗 Din kode: ' + kode)
    .setDescription([
      `**1.** Join serveren: \`${SERVER_IP}\``,
      `**2.** Skriv i chatten: \`/discord ${kode}\``,
      '**3.** Inden for et minut får du din rank-rolle her, en besked fra mig og en belønning ingame.',
      '', '⏳ Koden virker i 30 minutter. Del den ikke med andre.',
    ].join('\n'))] };
}
async function unlinkSvar(guild, discordId) {
  const l = linkAf(discordId);
  if (!l) return { content: 'Du er ikke forbundet. Tryk på **Forbind min konto** eller brug `/link`.', flags: MessageFlags.Ephemeral };
  delete linkData.links[discordId]; gemLink();
  postPrivat('link', { type: 'fjern', u: l.u }).catch(() => {});
  await synkRoller(guild, discordId, []);
  return { content: `Forbindelsen til **${l.n}** er fjernet, og dine rank-roller er taget af.`, flags: MessageFlags.Ephemeral };
}

// ---------- KATEGORIER ØVERST: 📊 STATS og 🔗 LINK DIN KONTO ----------
async function sikrKategori(guild, noegle, navn, position) {
  let k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
  if (!k) {
    k = await guild.channels.create({ name: navn, type: ChannelType.GuildCategory });
    config.kanaler[noegle] = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log(`Kategori ${navn} er oprettet.`);
  }
  if (k.position !== position) await k.setPosition(position).catch(() => {});
  return k;
}
// Låste voice-kanaler, som kun viser tal (ingen kan joine dem)
async function sikrStatKanal(guild, noegle, navn, parent) {
  let k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
  if (k) return k;
  k = await guild.channels.create({ name: navn, type: ChannelType.GuildVoice, parent: parent.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, allow: [P.ViewChannel], deny: [P.Connect] },
      { id: client.user.id, allow: [P.ViewChannel, P.ManageChannels, P.Connect] },
    ] });
  config.kanaler[noegle] = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  return k;
}
let statNavne = {};
async function opdaterStatsKategori() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const kat = await sikrKategori(guild, 'statskat', '📊 STATS', 0);
    let online = null; try { online = ((await hentWeb('stats')).online || []).length; } catch { /* hjemmesiden svarer ikke */ }
    const oensket = {
      statmedlemmer: `👥┃Medlemmer: ${guild.memberCount}`,
      statonline: `🟢┃Online ingame: ${online ?? '?'}`,
      statip: `🌐┃IP: ${SERVER_IP}`,
    };
    for (const [noegle, navn] of Object.entries(oensket)) {
      const k = await sikrStatKanal(guild, noegle, navn, kat);
      // Discord tillader kun 2 navneskift pr. 10 min pr. kanal - derfor kun ved ændring
      if (k.name !== navn && statNavne[noegle] !== navn) { statNavne[noegle] = navn; await k.setName(navn).catch(() => {}); }
    }
  } catch (e) { console.error('Stats-kategori:', e.message); }
}

async function opdaterLinkKanal(guild) {
  const kat = await sikrKategori(guild, 'linkkat', '🔗 LINK DIN KONTO', 1);
  let kanal = config.kanaler.link && await guild.channels.fetch(config.kanaler.link).catch(() => null);
  if (!kanal) {
    kanal = await guild.channels.create({ name: '📌┃link', type: ChannelType.GuildText, parent: kat.id,
      topic: 'Forbind din Minecraft-konto med Discord og få din rank-rolle',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
        { id: config.roller['Spiller'], allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] },
        ...STAFF.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] })),
      ] });
    config.kanaler.link = kanal.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#link er oprettet.');
  }
  const emb = new EmbedBuilder().setColor(LILLA).setAuthor({ name: 'HOPDOP · Link din konto' })
    .setTitle('🔗 Forbind Minecraft med Discord')
    .setDescription([
      'Forbind din Minecraft-konto med Discord og få:',
      '', '🏷️ **Din rank-rolle** automatisk (Legende, Mester, Diamant, Guld osv.)',
      '💰 **En belønning ingame** første gang du forbinder',
      '📊 **`/stats` uden navn** viser dine egne stats',
      '', '**Sådan gør du:**',
      '**1.** Tryk på **🔗 Forbind min konto** herunder. Du får en kode, som kun du kan se.',
      `**2.** Join \`${SERVER_IP}\`, og skriv \`/discord <kode>\` i chatten.`,
      '**3.** Færdig! Du får en besked fra mig inden for et minut.',
    ].join('\n'))
    .setThumbnail('attachment://ikon.png')
    .setFooter({ text: 'Din rolle følger med, hvis din rank ændres ingame' });
  const knapper = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('link_start').setLabel('Forbind min konto').setEmoji('🔗').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('link_status').setLabel('Er jeg forbundet?').setEmoji('❔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('link_fjern').setLabel('Fjern forbindelse').setEmoji('✖️').setStyle(ButtonStyle.Danger));
  const filer = fs.existsSync('assets/ikon.png') ? [new AttachmentBuilder('assets/ikon.png', { name: 'ikon.png' })] : [];
  if (!filer.length) emb.setThumbnail(null);
  const gammel = await bottensBesked(kanal);
  if (gammel) await gammel.edit({ embeds: [emb], components: [knapper], files: filer, attachments: [] });
  else await kanal.send({ embeds: [emb], components: [knapper], files: filer });
}

// ---------- SERVER-IKON OG BANNER (fra hjemmesidens logo) ----------
async function saetGrafik(guild) {
  config.grafik = config.grafik || {};
  const IKON_VERSION = 4, BANNER_VERSION = 4; // hæv tallet, når billedet skal skiftes igen
  if (config.grafik.ikon !== IKON_VERSION && fs.existsSync('assets/ikon.png')) {
    await guild.setIcon('assets/ikon.png', 'HOPDOP-logo').then(() => { config.grafik.ikon = IKON_VERSION; console.log('Server-ikon er sat.'); })
      .catch(e => console.error('Ikon:', e.message));
  }
  if (config.grafik.banner !== BANNER_VERSION && fs.existsSync('assets/banner.png')) {
    if (guild.premiumTier >= 2) {
      await guild.setBanner('assets/banner.png', 'HOPDOP-banner').then(() => { config.grafik.banner = BANNER_VERSION; console.log('Server-banner er sat.'); devlogDiscord('🖼️ Discorden har fået et nyt HOPDOP-banner'); })
        .catch(e => console.error('Banner:', e.message));
    } else if (!config.grafik.bannerSagt) {
      console.log(`Banner venter: Discord kræver boost-niveau 2 (nu niveau ${guild.premiumTier}). Det sættes automatisk, når I når det.`);
      config.grafik.bannerSagt = true;
    }
  }
  if (config.grafik.splash !== BANNER_VERSION && fs.existsSync('assets/banner.png') && guild.premiumTier >= 1) {
    await guild.setSplash('assets/banner.png', 'HOPDOP invite-baggrund').then(() => { config.grafik.splash = BANNER_VERSION; console.log('Invite-baggrund er sat.'); })
      .catch(e => console.error('Invite-baggrund:', e.message));
  }
  // Serverbeskrivelse (vises i invites og Discovery - kræver at serveren er en Community-server)
  if (config.grafik.beskrivelse !== SERVER_BESKRIVELSE) {
    await guild.edit({ description: SERVER_BESKRIVELSE, reason: 'HOPDOP-beskrivelse' })
      .then(() => { config.grafik.beskrivelse = SERVER_BESKRIVELSE; console.log('Serverbeskrivelse er sat.'); })
      .catch(e => console.log('Serverbeskrivelse kunne ikke sættes (kræver Community-server):', e.message));
  }
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}
const SERVER_BESKRIVELSE = `Dansk Minecraft HCF Kits-server på 1.8.9 🏯 Kits, teams, KOTH og duels. Join: ${SERVER_IP}`;
client.on('guildUpdate', (gl, ny) => { if (ny.premiumTier > gl.premiumTier) { saetGrafik(ny); opsaetPynt(ny); } if (ny.premiumSubscriptionCount !== gl.premiumSubscriptionCount) opdaterBoostHoved(ny); });

// ---------- #boosts: hvem har boosted serveren ----------
const BOOST_TYPER = { 8: 0, 9: 1, 10: 2, 11: 3 }; // Discords boost-beskeder -> niveau (0 = intet nyt niveau)
const sidstBoost = new Map(); // brugerId -> tid (så samme boost ikke skrives to gange)
async function boostKanal(guild) {
  return sikrKanal(guild, 'boosts', '🔮┃boosts', 'Tak til alle der booster HOPDOP! 💜', config.kanaler.velkommen);
}
async function opdaterBoostHoved(guild) {
  try {
    const kanal = await boostKanal(guild);
    const n = guild.premiumSubscriptionCount || 0, niv = guild.premiumTier || 0;
    const maal = [2, 7, 14][Math.min(niv, 2)];
    const emb = new EmbedBuilder().setColor(0xf47fff).setAuthor({ name: 'HOPDOP · Boosts' })
      .setTitle('💜 Tak til alle der booster HOPDOP!')
      .setDescription([
        `🔮 Boosts lige nu: **${n}**`,
        `⭐ Niveau: **${niv}**${niv < 3 ? ` · næste niveau ved **${maal}** boosts` : ' · max niveau!'}`,
        '', 'Hver gang nogen booster, bliver det skrevet herunder. Tak for støtten! 🙏',
        niv < 2 ? '\n*Ved niveau 2 får Discorden sit HOPDOP-banner øverst i kanallisten.*' : '',
      ].join('\n'))
      .setThumbnail('attachment://ikon.png');
    const filer = fs.existsSync('assets/ikon.png') ? [new AttachmentBuilder('assets/ikon.png', { name: 'ikon.png' })] : [];
    if (!filer.length) emb.setThumbnail(null);
    const gammel = await bottensBesked(kanal);
    if (gammel && gammel.embeds.length) await gammel.edit({ embeds: [emb], files: filer, attachments: [] });
    else await kanal.send({ embeds: [emb], files: filer });
  } catch (e) { console.error('Boost-kanal:', e.message); }
}
async function skrivBoost(guild, bruger, antal = 1, niveau = 0) {
  if (Date.now() - (sidstBoost.get(bruger.id) || 0) < 60000) return;
  sidstBoost.set(bruger.id, Date.now());
  const kanal = await boostKanal(guild);
  const navn = `<@${bruger.id}>`;
  let tekst = antal > 1 ? `🔮 ${navn} boostede lige serveren **${antal}** gange!` : `🔮 ${navn} har lige boosted serveren!`;
  if (niveau) tekst += ` HOPDOP har opnået **Niveau ${niveau}!** 🎉`;
  await kanal.send({ content: tekst, allowedMentions: { parse: [] } }).catch(e => console.error('Boost:', e.message));
  devlogDiscord(`💜 ${bruger.username} har boosted Discorden`);
}
// ================= CENSUR: grove ord bliver til spoilers =================
// Botten sletter beskeden og sender den igen (med spillerens navn og billede), hvor det grove ord står som ||spoiler||.
const LEET = { a: '[a@4]', e: '[e3]', i: '[i1!|l]', o: '[o0]', s: '[s$5z]', g: '[g9]', u: '[uv]' };
const bogstav = c => LEET[c] || c;
// ord -> regex: tillader gentagne bogstaver, tegn imellem (n.i.g.g.e.r) og tal-erstatninger
function ordRegex(ord, { graense = true, ekstra = '' } = {}) {
  const dele = [...ord].map(c => `${bogstav(c)}+`).join('[\\s._*\\-]*');
  return new RegExp(`${graense ? '(?<![a-zæøå])' : ''}${dele}${ekstra}${graense ? '(?![a-zæøå])' : ''}`, 'giu');
}
const CENSUR = [
  new RegExp('(?<!s)n+[\\s._*\\-]*[i1!|l]+[\\s._*\\-]*[g9]+[\\s._*\\-]*[g9]+[\\s._*\\-]*(?:[e3]+[\\s._*\\-]*r+|[a@4]+h*|[e3]+[a@4]+)s*', 'giu'), // n-ordet
  ordRegex('neger', { ekstra: 's?' }), ordRegex('faggot'), ordRegex('fagot'), ordRegex('kike', { ekstra: 's?' }), ordRegex('chink'), ordRegex('spic'),
  ordRegex('tranny'), ordRegex('paki'), ordRegex('retard', { ekstra: '(?:ed|s)?' }), ordRegex('spasser', { ekstra: 's?' }), ordRegex('mongol', { ekstra: 's?' }),
  ordRegex('bøsserøv'), ordRegex('niggerjøde'), ordRegex('sandneger'), ordRegex('abekat'),
];
// Censur kan slås til/fra med /censur (gemmes i censur.json)
const CENSUR_FIL = 'censur.json';
let censurTil = (() => { try { return JSON.parse(fs.readFileSync(CENSUR_FIL, 'utf8')).til !== false; } catch { return true; } })();
const saetCensur = til => { censurTil = til; fs.writeFileSync(CENSUR_FIL, JSON.stringify({ til })); };
function censurMark(tekst) { // grove ord får tegnene \u0001 ... \u0002 omkring sig
  let ud = String(tekst), ramt = false;
  if (!censurTil) return null;
  for (const re of CENSUR) ud = ud.replace(re, ord => { ramt = true; return `\u0001${ord.replace(/\|/g, '')}\u0002`; });
  return ramt ? ud : null;
}
const markTilSpoiler = t => t.replace(/\u0001/g, '||').replace(/\u0002/g, '||');
const censurer = tekst => { const m = censurMark(tekst); return m ? markTilSpoiler(m) : null; };
// Til live-chat: escape resten af teksten, men gør grove ord til spoilers
const penTekst = (tekst, max = 1000) => markTilSpoiler(escapeMarkdown(censurMark(tekst) ?? String(tekst), { spoiler: false })).slice(0, max);
const censurHits = new Map();
const censurHook = new Map(); // kanalId -> webhook
async function censurSend(m, tekst) {
  const kanal = m.channel.isThread() ? m.channel.parent : m.channel;
  const trad = m.channel.isThread() ? { threadId: m.channel.id } : {};
  let hook = censurHook.get(kanal.id);
  if (!hook && kanal.fetchWebhooks) {
    hook = (await kanal.fetchWebhooks().catch(() => null))?.find(h => h.owner?.id === client.user.id && h.name === 'HOPDOP Censur')
      || await kanal.createWebhook({ name: 'HOPDOP Censur' }).catch(() => null);
    if (hook) censurHook.set(kanal.id, hook);
  }
  const navn = m.member?.displayName || m.author.username;
  if (hook) return hook.send({ content: tekst, username: navn.slice(0, 80), avatarURL: m.author.displayAvatarURL(), allowedMentions: { parse: [] }, ...trad }).catch(() => m.channel.send({ content: `**${escapeMarkdown(navn)}:** ${tekst}`, allowedMentions: { parse: [] } }));
  return m.channel.send({ content: `**${escapeMarkdown(navn)}:** ${tekst}`, allowedMentions: { parse: [] } });
}
client.on('messageCreate', async m => {
  try {
    if (!censurTil || !MESSAGE_CONTENT || !m.guild || m.author.bot || m.webhookId || m.system || !m.content) return;
    const ny = censurer(m.content);
    if (!ny || m.attachments.size) return;
    await m.delete().catch(() => {});
    const nu = Date.now(), h = (censurHits.get(m.author.id) || []).filter(t => nu - t < 10 * 60000); h.push(nu); censurHits.set(m.author.id, h);
    if (h.length === 3) mistanke('Grove ord', `<@${m.author.id}> (${escapeMarkdown(m.author.username)}) har brugt grove ord ${h.length} gange på 10 minutter i <#${m.channel.id}>.`, 0xf59e0b);
    await censurSend(m, ny.slice(0, 2000));
  } catch (e) { console.error('Censur:', e.message); }
});

// Discord sender selv en "boost"-besked i systemkanalen - den læser vi
client.on('messageCreate', m => {
  if (!m.guild || !(m.type in BOOST_TYPER)) return;
  const antal = Number(m.content) || 1;
  skrivBoost(m.guild, m.author, antal, BOOST_TYPER[m.type]);
});
// Reserve: hvis systembeskeden er slået fra, ser vi det på medlemmet i stedet
client.on('guildMemberUpdate', (gl, ny) => {
  if (!gl.premiumSince && ny.premiumSince) setTimeout(() => skrivBoost(ny.guild, ny.user), 15000);
});

// ================= BRO TIL MINECRAFT (DiscordBro.sk) =================
// Kommandoer fra Discord sendes via hjemmesiden til serveren. Chatten ingame kommer i #live-chat.

// ---------- ADGANG ("databasen"): hvilke roller må bruge hvad. Gemmes i adgang.json ----------
const ADGANG_FIL = 'adgang.json';
const ADGANG_KOMMANDOER = {
  konsol: 'Kør en hvilken som helst konsol-kommando', ban: 'Ban en spiller', mute: 'Mute en spiller', kick: 'Kick en spiller',
  unban: 'Fjern en ban', unmute: 'Fjern en mute', alts: 'Find alt-konti', genstart: 'Genstart serveren',
  beacondrop: 'Start/stop Beacon Drop', broadcast: 'Send en broadcast', sig: 'Skriv i chatten ingame', livechat: 'Se #live-chat',
};
const adgang = (() => { try { return JSON.parse(fs.readFileSync(ADGANG_FIL, 'utf8')); } catch { return {}; } })();
for (const k of Object.keys(ADGANG_KOMMANDOER)) if (!adgang[k]) adgang[k] = ['Ejer']; // kun Ejer til at starte med
const gemAdgang = () => fs.writeFileSync(ADGANG_FIL, JSON.stringify(adgang, null, 2));
gemAdgang();
const erEjer = m => m.guild.ownerId === m.id || m.roles.cache.has(config.roller['Ejer']);
const harAdgang = (m, k) => erEjer(m) || (adgang[k] || []).some(navn => m.roles.cache.some(r => r.name === navn));

// ---------- Send til serveren og vent på svar ----------
const ventSvar = new Map(); // id -> { i, tekst, timer }
async function tilServer(i, kommando, beskrivelse, udenSvar = false) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  let id;
  try { ({ id } = await postPrivat('bro', { type: 'kommando', kommando, af: i.user.username })); }
  catch (e) { return i.editReply(`❌ Kunne ikke sende til serveren: ${e.message}`); }
  if (udenSvar) { logBro(i.user, kommando); return i.editReply(`✅ ${beskrivelse}: sendt. Den kommer ingame inden for ca. 5 sekunder.`); }
  await i.editReply(`⏳ ${beskrivelse} ... sendt til serveren, venter på svar.`);
  const timer = setTimeout(() => {
    ventSvar.delete(id);
    i.editReply(`⚠️ ${beskrivelse}: sendt, men serveren har ikke svaret inden for 40 sek. Kører DiscordBro.sk? (Tjek `/discordbro` ingame.)`).catch(() => {});
  }, 40000);
  ventSvar.set(id, { i, beskrivelse, timer });
  logBro(i.user, kommando);
}
// #bot-logs: kun Ejer og Admin kan se kommandoer sendt fra Discord til serveren (holdes væk fra #straf-log)
async function botLogKanal() {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  let k = config.kanaler.botlog && await guild.channels.fetch(config.kanaler.botlog).catch(() => null);
  if (!k) {
    await guild.roles.fetch();
    const parent = config.kanaler.adminkat || (await guild.channels.fetch(config.kanaler.staffchat).catch(() => null))?.parentId;
    const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] }];
    for (const n of ['Ejer', 'Admin']) { const r = guild.roles.cache.find(x => x.name === n); if (r) ow.push({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] }); }
    k = await guild.channels.create({ name: '🤖┃bot-logs', type: ChannelType.GuildText, parent: parent || undefined,
      topic: 'Kommandoer sendt fra Discord til Minecraft-serveren. Kun Ejer og Admin kan se kanalen.', permissionOverwrites: ow });
    config.kanaler.botlog = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#bot-logs er oprettet.');
  }
  return k;
}
function logBro(bruger, kommando) {
  botLogKanal().then(k => k.send({ embeds: [new EmbedBuilder().setColor(0x64748b)
    .setAuthor({ name: 'HOPDOP · Kommando fra Discord' }).setDescription(`${bruger} kørte: \`${kommando.replace(/`/g, "'")}\``).setTimestamp()] })).catch(e => console.error('#bot-logs:', e.message));
}

// ---------- Hent chat og svar (hvert 3. sek.) ----------
let broNr = null;
async function liveChatKanal(guild) {
  let k = config.kanaler.livechat && await guild.channels.fetch(config.kanaler.livechat).catch(() => null);
  if (!k) {
    const parent = config.kanaler.adminkat || (await guild.channels.fetch(config.kanaler.staffchat).catch(() => null))?.parentId;
    k = await guild.channels.create({ name: '💬┃live-chat', type: ChannelType.GuildText, parent: parent || undefined,
      topic: 'Chatten fra Minecraft i realtid. Skriv /sig for at skrive ingame.', permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }] });
    config.kanaler.livechat = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#live-chat er oprettet.');
  }
  return k;
}
// #live-kommandoer: alle kommandoer spillerne skriver ingame (adskilt fra den almindelige chat)
async function kommandoKanal(guild) {
  let k = config.kanaler.livekom && await guild.channels.fetch(config.kanaler.livekom).catch(() => null);
  if (!k) {
    const lc = await liveChatKanal(guild);
    k = await guild.channels.create({ name: '⌨️┃live-kommandoer', type: ChannelType.GuildText, parent: lc.parentId || undefined,
      topic: 'Alle kommandoer spillere bruger ingame, i realtid. Kun staff.', permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }] });
    config.kanaler.livekom = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#live-kommandoer er oprettet.');
  }
  return k;
}
// #mistanke: alle 🚩 samlet ét sted, så staff kun skal følge én kanal
async function mistankeKanal(guild) {
  let k = config.kanaler.mistanke && await guild.channels.fetch(config.kanaler.mistanke).catch(() => null);
  if (!k) {
    const lc = await liveChatKanal(guild);
    k = await guild.channels.create({ name: '🚨┃mistanke', type: ChannelType.GuildText, parent: lc.parentId || undefined,
      topic: 'Automatiske advarsler: join/leave-spam, gengangere med mange straffe og gentagen brug af grove ord. Kun staff.', permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }] });
    config.kanaler.mistanke = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#mistanke er oprettet.');
  }
  return k;
}
async function mistanke(titel, tekst, farve = 0xef4444) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const k = await mistankeKanal(guild);
    await k.send({ embeds: [new EmbedBuilder().setColor(farve).setTitle(`🚩 ${titel}`).setDescription(tekst).setTimestamp()] });
  } catch (e) { console.error('#mistanke:', e.message); }
}
// Kategorien "Logs": samler alle log-kanaler. Kun staff kan se den.
const LOGS_KAT = '📜┃Logs';
async function opsaetLogs(guild) {
  let kat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === LOGS_KAT);
  if (!kat) kat = await guild.channels.create({ name: LOGS_KAT, type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels] }] }).catch(e => { console.error('Logs-kategori:', e.message); return null; });
  if (!kat) return;
  for (const noegle of ['straflog', 'botlog', 'joinleave', 'livekom', 'mistanke']) {
    const id = config.kanaler[noegle]; const k = id && await guild.channels.fetch(id).catch(() => null);
    if (k && k.parentId !== kat.id) await k.setParent(kat.id, { lockPermissions: false, reason: 'Samlet i Logs' }).catch(e => console.error(`Flyt ${noegle}:`, e.message));
  }
}
// #join-leave: samme adgang som #live-chat, men kun joins/leaves - så de ikke fylder i den almindelige chat
async function joinLeaveKanal(guild) {
  let k = config.kanaler.joinleave && await guild.channels.fetch(config.kanaler.joinleave).catch(() => null);
  if (!k) {
    const lc = await liveChatKanal(guild);
    k = await guild.channels.create({ name: '🚪┃join-leave', type: ChannelType.GuildText, parent: lc.parentId || undefined,
      topic: 'Hvem joiner og forlader serveren ingame, med spilletid. 🚩 markerer mistænkelig join/leave-spam. Kun staff.', permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }] });
    config.kanaler.joinleave = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#join-leave er oprettet.');
  }
  return k;
}
// Kun rollerne i adgang.livechat (og Ejer) kan se #live-chat
async function opdaterLiveChatAdgang(guild) {
  const k = await liveChatKanal(guild);
  const jl = await joinLeaveKanal(guild);
  const kk = await kommandoKanal(guild);
  const mk = await mistankeKanal(guild);
  const roller = new Set(['Ejer', ...(adgang.livechat || [])]);
  const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages] }];
  for (const navn of roller) { const r = guild.roles.cache.find(x => x.name === navn); if (r) ow.push({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] }); }
  await k.permissionOverwrites.set(ow).catch(e => console.error('#live-chat adgang:', e.message));
  await jl.permissionOverwrites.set(ow).catch(e => console.error('#join-leave adgang:', e.message));
  await kk.permissionOverwrites.set(ow).catch(e => console.error('#live-kommandoer adgang:', e.message));
  await mk.permissionOverwrites.set(ow).catch(e => console.error('#mistanke adgang:', e.message));
}
const klok = t => new Date(t).toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' });
const RANK_IKON = { Ejer: '👑', Admin: '🔴', Mod: '🟣', 'Hjælper': '🟢', Builder: '🔷', Legende: '💎', Mester: '💠', Diamant: '💎', Guld: '🟡', 'Sølv': '⚪', Bronze: '🟤' };
// Join/leave-overvågning: spilletid og join/leave-spam (kan være omgåelse af straf, bot-angreb eller combat-log)
const joinTid = new Map(), joinHist = new Map();
function joinFlag(navn, t) {
  const n = navn.toLowerCase(); joinTid.set(n, t);
  const h = (joinHist.get(n) || []).filter(x => t - x < 10 * 60000); h.push(t); joinHist.set(n, h);
  if (h.length >= 4) { if (h.length === 4) mistanke('Join/leave-spam', `**${escapeMarkdown(navn)}** har joinet ${h.length} gange på 10 minutter. Tjek for omgåelse af straf eller combat-log.`); return ` 🚩 **${h.length}. join på 10 min**`; }
  return h.length === 3 ? ' ⚠️ 3. join på 10 min' : '';
}
function spilletid(navn, t) {
  const n = navn.toLowerCase(), start = joinTid.get(n); joinTid.delete(n);
  if (!start) return '';
  const sek = Math.max(0, Math.round((t - start) / 1000));
  const tekst = sek < 60 ? `${sek} sek.` : sek < 3600 ? `${Math.round(sek / 60)} min.` : `${Math.floor(sek / 3600)} t. ${Math.round((sek % 3600) / 60)} min.`;
  return ` · online i ${tekst}${sek < 20 ? ' 🚩 forlod efter få sekunder' : ''}`;
}
function chatLinje(c) {
  const [type, a, ...rest] = c.tekst.split('|');
  const b = rest.join('|');
  const tid = `\`${klok(c.t)}\``;
  const e = escapeMarkdown;
  if (type === 'C') return `${tid} 💬 **${e(a)}** » ${penTekst(b)}`;
  if (type === 'J') return `${tid} 🟢 **${e(a)}** joinede serveren${joinFlag(a, c.t)}`;
  if (type === 'Q') return `${tid} 🔴 **${e(a)}** forlod serveren${spilletid(a, c.t)}`;
  if (type === 'D') return `${tid} 💀 ${e(a)}`;
  if (type === 'K') { // K|rank|spiller|/kommando
    const [spiller, ...k] = rest;
    const rank = a && a !== '*' ? `${RANK_IKON[a] || '▫️'} ` : '';
    const kom = k.join('|').slice(0, 150);
    return `${tid} ⌨️ ${rank}**${e(spiller || '?')}** brugte ${censurMark(kom) ? penTekst(kom, 150) : `\`${kom.replace(/`/g, "'")}\``}`;
  }
  return `${tid} ${penTekst(c.tekst)}`;
}
async function tjekBro() {
  if (!botNoegle()) return;
  try {
    const d = await hentPrivat(`bro?efter=${broNr ?? 0}`);
    const foerste = broNr === null;
    broNr = d.nr;
    if (foerste) return; // gammel chat fra før botten startede vises ikke
    for (const s of d.svar) {
      const v = ventSvar.get(s.id);
      if (!v) continue;
      clearTimeout(v.timer); ventSvar.delete(s.id);
      v.i.editReply(`✅ ${v.beskrivelse}\n> ${s.tekst}`).catch(() => {});
    }
    if (d.chat.length) {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const k = await liveChatKanal(guild);
      const jl = await joinLeaveKanal(guild);
      const send = async (kanal, linjer) => {
        let blok = '';
        for (const l of linjer) {
          if ((blok + l).length > 1900) { await kanal.send({ content: blok, allowedMentions: { parse: [] } }); blok = ''; }
          blok += l + '\n';
        }
        if (blok) await kanal.send({ content: blok, allowedMentions: { parse: [] } });
      };
      const jlTyper = c => ['J', 'Q'].includes(c.tekst.split('|')[0]);
      const kom = await kommandoKanal(guild);
      const komTyper = c => c.tekst.split('|')[0] === 'K';
      await send(k, d.chat.filter(c => !jlTyper(c) && !komTyper(c)).map(chatLinje));
      await send(jl, d.chat.filter(jlTyper).map(chatLinje));
      await send(kom, d.chat.filter(komTyper).map(chatLinje));
    }
  } catch (e) { if (!String(e.message).includes('fetch failed')) console.error('Bro:', e.message); }
}

// ---------- STRAF-GRUNDE (samme nøgler som i Straf.sk) ----------
const GRUNDE = {
  ban: { hack: 'Hack / Cheats', hate: 'Hadeforbrydelse', bug: 'Bug-misbrug', dupe: 'Duplikering', evade: 'Omgåelse af straf (alt)', scam: 'Svindel', threat: 'Trusler / DDoS', team: 'Ulovlig alliance', dox: 'Deling af persondata', claim: 'Misbrug af claim', custom: 'Skriv selv (vælg tid)' },
  mute: { racism: 'Racisme', spam: 'Spam', ad: 'Reklame', lang: 'Sprog', provo: 'Provokerende', threat: 'Trusler', bully: 'Mobning / Chikane', staff: 'Respektløs mod staff', caps: 'Caps / Chat-misbrug', custom: 'Skriv selv (vælg tid)' },
  kick: { provo: 'Provokerende adfærd', pause: 'Tag en pause', warn: 'Advarsel', afk: 'AFK / Inaktiv', rules: 'Regelbrud', ad: 'Reklame', custom: 'Skriv selv' },
};
const MC_NAVN = /^[A-Za-z0-9_]{1,16}$/;

// ---------- BOT-LOGO ----------
async function saetBotLogo() {
  const V = 4; // 4 = originale billeder
  config.grafik = config.grafik || {};
  if (config.grafik.botlogo === V) return;
  let ok = true;
  if (fs.existsSync('assets/bot-logo.png')) await client.user.setAvatar('assets/bot-logo.png').catch(e => { ok = false; console.error('Bot-logo:', e.message); });
  if (fs.existsSync('assets/bot-banner.png') && typeof client.user.setBanner === 'function') await client.user.setBanner('assets/bot-banner.png').catch(e => { ok = false; console.error('Bot-banner:', e.message); });
  if (ok) { config.grafik.botlogo = V; fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); console.log('Bot-logo og banner er sat.'); }
}

// ================= RETTIGHEDER, BOT-ROLLE OG PANELER =================
const ANSOG_LINKS = [['Staff', 'staff', '🛡️'], ['Bygger', 'bygger', '🔨'], ['Unban', 'unban', '🔓']];
async function opdaterPanel(kanal, find, besked) {
  const gamle = await kanal.messages.fetch({ limit: 30 }).catch(() => null);
  const fastgjort = await kanal.messages.fetchPinned().catch(() => null);
  const m = gamle?.find(x => x.author.id === client.user.id && x.embeds[0]?.title === find)
    || fastgjort?.find(x => x.author.id === client.user.id && x.embeds[0]?.title === find);
  if (m) return m.edit(besked).catch(e => { console.error('Panel:', e.message); return null; });
  return kanal.send(besked).catch(e => { console.error('Panel:', e.message); return null; });
}
// Ingen roller kan pinges af spillere, og @everyone/@here er slået fra for alle uden for staff
async function laasPings(guild) {
  await guild.roles.fetch();
  const ev = guild.roles.everyone;
  if (ev.permissions.has(P.MentionEveryone)) await ev.setPermissions(ev.permissions.remove(P.MentionEveryone)).catch(e => console.error('@everyone-rettighed:', e.message));
  for (const r of guild.roles.cache.values()) {
    if (r.id === ev.id || r.managed) continue;
    if (r.mentionable) await r.setMentionable(false).catch(e => console.error(`Kan ikke låse pings på ${r.name} (flyt botten højere op i rollelisten):`, e.message));
    if (!STAFF.includes(r.id) && r.permissions.has(P.MentionEveryone) && !r.permissions.has(P.Administrator)) await r.setPermissions(r.permissions.remove(P.MentionEveryone)).catch(() => {});
  }
}
client.on('messageCreate', async m => {
  try {
    if (!m.guild || m.author.bot || m.webhookId || m.system) return;
    if (!m.mentions.everyone && !m.mentions.roles.size) return;
    if (m.member?.permissions.has(P.Administrator) || m.member?.roles.cache.some(r => STAFF.includes(r.id))) return;
    await m.delete().catch(() => {});
    const w = await m.channel.send({ content: `${m.author}, du kan ikke tagge roller eller alle. Tag en enkelt spiller i stedet. 🚫`, allowedMentions: { users: [m.author.id] } }).catch(() => null);
    if (w) setTimeout(() => w.delete().catch(() => {}), 8000);
  } catch (e) { console.error('Ping-lås:', e.message); }
});
// Kanaler hvor spillere kun må læse (og evt. reagere): ingen skrivning, ingen tråde
const LAESE_KANALER = { velkommen: false, regler: false, nyheder: false, events: false, devlog: false, serverip: false, giveaways: false, leaderboards: false, serverstatus: false,
  boosts: false, botguide: false, link: false, roller: true, forslag: true, ticket: false }; // true = må reagere
async function laasLaeseKanaler(guild) {
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  for (const [noegle, reager] of Object.entries(LAESE_KANALER)) {
    const k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
    if (!k || !k.permissionOverwrites) continue;
    const lås = { SendMessages: false, AddReactions: reager, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false };
    for (const id of [guild.roles.everyone.id, spiller?.id].filter(Boolean)) await k.permissionOverwrites.edit(id, lås).catch(e => console.error(`Lås ${noegle}:`, e.message));
  }
}
// ================= COOLDOWN (slowmode) OG SAMTALE-VAGT =================
const SLOWMODE = { chat: 3, medier: 10, memes: 10, botcmd: 5 }; // sekunder mellem beskeder (staff er undtaget af Discord)
async function saetSlowmode(guild) {
  for (const [noegle, sek] of Object.entries(SLOWMODE)) {
    const k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
    if (k && k.rateLimitPerUser !== sek) await k.setRateLimitPerUser(sek, 'HOPDOP cooldown').catch(e => console.error(`Slowmode ${noegle}:`, e.message));
  }
}
// I disse kanaler skal der ikke føres lange samtaler (det hører til i #chat)
const IKKE_SNAK = ['medier', 'memes', 'botcmd'];
let samtaleTest = false; // test-tilstand: staff er IKKE undtaget (slås fra ved genstart)
const snakBuffer = new Map(); // kanalId -> [{ a, t }]
const snakAdvaret = new Map(); // kanalId -> { par, t }
client.on('messageCreate', async m => {
  try {
    if (!m.guild || m.author.bot || m.webhookId || m.system || !m.member) return;
    if (!IKKE_SNAK.some(n => config.kanaler[n] === m.channelId)) return;
    if (!samtaleTest && (erStaff(m.member) || m.member.permissions.has(P.Administrator))) return;
    const nu = Date.now();
    const buf = (snakBuffer.get(m.channelId) || []).filter(x => nu - x.t < 10 * 60000); buf.push({ a: m.author.id, t: nu });
    snakBuffer.set(m.channelId, buf.slice(-30));
    const sidste = buf.slice(-14);
    const folk = [...new Set(sidste.map(x => x.a))];
    if (sidste.length < 10 || folk.length !== 2) return;
    const skift = sidste.filter((x, n) => n && x.a !== sidste[n - 1].a).length;
    const hver = folk.map(f => sidste.filter(x => x.a === f).length);
    if (skift < 5 || Math.min(...hver) < 3) return; // skal ligne en frem-og-tilbage-samtale
    const par = folk.slice().sort().join('|');
    const adv = snakAdvaret.get(m.channelId);
    const chat = `<#${config.kanaler.chat}>`;
    snakBuffer.set(m.channelId, []);
    if (adv && adv.par === par && nu - adv.t < 20 * 60000) {
      // Bliver de ved efter advarslen: lille automute på 5 minutter
      for (const f of folk) { const mem = await m.guild.members.fetch(f).catch(() => null); if (mem && (samtaleTest || !erStaff(mem))) await mem.timeout(5 * 60000, 'Samtale i forkert kanal (efter advarsel)').catch(e => console.error('Automute:', e.message)); }
      snakAdvaret.delete(m.channelId);
      const b = await m.channel.send({ content: `🔇 <@${folk[0]}> og <@${folk[1]}> er sat på mute i 5 minutter, fordi I blev ved. Brug ${chat} til at snakke sammen.`, allowedMentions: { users: folk } }).catch(() => null);
      if (b) setTimeout(() => b.delete().catch(() => {}), 2 * 60000);
      return;
    }
    snakAdvaret.set(m.channelId, { par, t: nu });
    const b = await m.channel.send({ content: `⚠️ <@${folk[0]}> <@${folk[1]}> – dette er ikke en kanal til samtaler eller diskussioner. Gå over i ${chat}, hvis I vil snakke sammen. 💬\nBliver I ved her, får I en kort mute på 5 minutter.`, allowedMentions: { users: folk } }).catch(() => null);
    if (b) setTimeout(() => b.delete().catch(() => {}), 2 * 60000);
  } catch (e) { console.error('Samtale-vagt:', e.message); }
});
// ================= COMMUNITY-INDSTILLINGER OG SERVERNAVN (kører én gang pr. version) =================
const SERVER_NAVN = '⚔️ | HopDop HCF'; // ret navnet her og hæv COMMUNITY_VERSION, hvis du vil have et andet
const COMMUNITY_VERSION = 1;
async function opsaetCommunity(guild) {
  config.community = config.community || {};
  if (config.community.v === COMMUNITY_VERSION) return;
  const k = config.kanaler;
  const fund = id => id && guild.channels.cache.has(id) ? id : undefined;
  const aendr = {
    name: SERVER_NAVN,
    preferredLocale: 'da',
    verificationLevel: 2,          // kræver verificeret e-mail og at kontoen er over 5 min gammel
    explicitContentFilter: 2,      // scan alle medlemmers billeder
    defaultMessageNotifications: 1, // kun @mentions som standard (mindre støj)
    rulesChannel: fund(k.regler),
    publicUpdatesChannel: fund(k.staffnyheder) || fund(k.botlog),
    safetyAlertsChannel: fund(k.alarmer) || fund(k.botlog),
  };
  Object.keys(aendr).forEach(n => aendr[n] === undefined && delete aendr[n]);
  await guild.edit({ ...aendr, reason: 'HOPDOP Community-opsætning' })
    .then(() => console.log('Community: servernavn, regler-kanal, opdaterings-kanal, sprog og sikkerhed er sat.'))
    .catch(e => console.error('Community-indstillinger:', e.message));
  // Velkomstskærm (vises til nye medlemmer)
  const velkomst = [['regler', '📜', 'Læs reglerne før du spiller'], ['serverip', '🌐', 'Server-IP og sådan joiner du'], ['chat', '💬', 'Snak med resten af fællesskabet'], ['ticket', '🎫', 'Brug for hjælp? Opret en ticket'], ['nyheder', '📢', 'Seneste nyt fra HopDop']]
    .filter(([n]) => fund(k[n])).map(([n, e, d]) => ({ channel_id: k[n], description: d, emoji_name: e }));
  await guild.client.rest.patch(`/guilds/${guild.id}/welcome-screen`, { body: { enabled: true, description: 'Velkommen til HopDop – dansk Minecraft HCF & KitPvP på 1.8.9! 🏯', welcome_channels: velkomst } })
    .then(() => console.log('Community: velkomstskærm er sat.')).catch(e => console.error('Velkomstskærm:', e.message));
  // Onboarding (kræver mange synlige kanaler – prøver, og fortæller hvis Discord afviser det)
  const synlige = [k.velkommen, k.regler, k.serverip, k.nyheder, k.events, k.chat, k.medier, k.memes, k.botcmd].filter(fund);
  await guild.client.rest.put(`/guilds/${guild.id}/onboarding`, { body: { enabled: true, mode: 0, default_channel_ids: synlige, prompts: [] } })
    .then(() => console.log('Community: onboarding er slået til.')).catch(e => console.log('Onboarding kunne ikke slås til automatisk (Discord kræver mindst 7 synlige kanaler og et spørgsmål) – slå den til under Server Settings → Onboarding:', e.message));
  config.community.v = COMMUNITY_VERSION; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}
// ================= EKSTRA FUNKTIONER: forum, events, onboarding, emojis, lyde, rolleikoner =================
const DK_EMOJI = { hoppe_graeder: 'hoppe_græder', hoppe_taenker: 'hoppe_tænker', hoppe_mistaenkelig: 'hoppe_mistænkelig', hoppe_stoette: 'hoppe_støtte', hoppe_graeskar: 'hoppe_græskar', hoppe_nervos: 'hoppe_nervøs', hopdop_groen: 'hopdop_grøn', hopdop_roed: 'hopdop_rød' };
const EKSTRA_DATA = fs.existsSync('./ekstra-data.js') ? require('./ekstra-data.js') : { emojis: {}, lyde: {} };
const FORSLAG_TAGS = [['Nyt', '🆕'], ['Godkendt', '✅'], ['Afvist', '❌'], ['Overvejes', '🤔']];
const FEJL_TAGS = [['Ny', '🆕'], ['I gang', '🛠️'], ['Løst', '✅']];
const FORSLAG_SKABELON = `💡 **Sådan laver du et forslag**
Skriv /forslag i #bot-kommandoer – og følg skabelonen (kopiér og udfyld):

**Titel:** (kort og tydeligt, fx "Ny KOTH-belønning")
**Hvad vil du have ændret eller tilføjet?**
(beskriv idéen i 1-3 sætninger)
**Hvorfor er det en god idé?**
(hvad får serveren og spillerne ud af det?)
**Sådan kunne det virke:**
(eksempler, tal eller trin, hvis du har dem)

Regler: ét forslag pr. tråd · tjek først, at det ikke allerede er foreslået · vær venlig i kommentarerne · stem med 👍`;
const FEJL_SKABELON = `🐛 **Skabelon til fejlrapporter** (kopiér og udfyld)

**Ingame navn:**
**Hvornår skete det?** (dato og cirka klokkeslæt)
**Hvad skete der?**
**Hvad forventede du skulle ske?**
**Sådan kan vi gentage fejlen:** (trin 1, 2, 3)
**Billede eller video:** (vedhæft i ticketten)

Staff skifter tagget: Ny → I gang → Løst.`;
const tagId = (forum, navn) => forum?.availableTags?.find(t => t.name === navn)?.id;
async function sikrForum(guild, noegle, navn, topic, tags, ow, parent) {
  let f = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
  if (f) { await f.permissionOverwrites.set(ow).catch(() => {}); if (f.topic !== topic) await f.setTopic(topic).catch(() => {}); return f; }
  f = await guild.channels.create({ name: navn, type: ChannelType.GuildForum, topic, parent, permissionOverwrites: ow,
    availableTags: tags.map(([n, e]) => ({ name: n, emoji: { id: null, name: e } })), defaultReactionEmoji: { id: null, name: '👍' } })
    .catch(e => { console.error(`Forum ${navn} (kræver Community):`, e.message); return null; });
  if (f) { config.kanaler[noegle] = f.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); }
  return f;
}
async function opsaetForummer(guild) {
  await guild.channels.fetch(); await guild.roles.fetch();
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  const botOw = { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.CreatePublicThreads, P.ManageThreads, P.SendMessagesInThreads, P.EmbedLinks, P.AddReactions, P.ReadMessageHistory] };
  const staffOw = STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessagesInThreads, P.ManageThreads, P.AddReactions] }));
  // Forslag-forummet er fjernet (forslag er tilbage som beskeder i #forslag) - slet det, hvis det findes
  if (config.kanaler.forslagforum) {
    const gammel = await guild.channels.fetch(config.kanaler.forslagforum).catch(() => null);
    if (gammel) await gammel.delete('Forslag er tilbage som almindelig kanal').catch(e => console.error('Slet forslag-forum:', e.message));
    delete config.kanaler.forslagforum; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('Forslag-forummet er slettet. Forslag sendes igen til #forslag.');
  }
  // Fejlrapporter-forum: kun staff - hver fejlrapport-ticket får en tråd her
  const fejlOw = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, botOw, ...STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.CreatePublicThreads, P.SendMessagesInThreads, P.ManageThreads] }))];
  const staffKat = guild.channels.cache.get(config.kanaler.staffchat)?.parentId;
  await sikrForum(guild, 'fejlforum', '🐛┃fejlrapporter', FEJL_SKABELON, FEJL_TAGS, fejlOw, staffKat || undefined);
}
async function opretForslagTraad(guild, sid, ign, bruger, tekst) {
  const forum = config.kanaler.forslagforum && await guild.channels.fetch(config.kanaler.forslagforum).catch(() => null);
  if (!forum || forum.type !== ChannelType.GuildForum) return null;
  const traad = await forum.threads.create({ name: tekst.replace(/\s+/g, ' ').slice(0, 80) || 'Nyt forslag', appliedTags: [tagId(forum, 'Nyt')].filter(Boolean),
    message: { embeds: [new EmbedBuilder().setColor(FARVE).setTitle('Nyt forslag!').addFields(
      { name: 'Indsender', value: `${bruger.username} \`[${bruger.id}]\`` }, { name: 'Ingame navn', value: ign }, { name: 'Forslag', value: tekst.slice(0, 1000) })
      .setFooter({ text: `Bruger-ID: ${bruger.id} | sID: ${sid} • ${dato()}` })] } }).catch(e => { console.error('Forslag-tråd:', e.message); return null; });
  if (!traad) return null;
  const start = await traad.fetchStarterMessage().catch(() => null);
  if (start) { await start.react('✅').catch(() => {}); await start.react('❌').catch(() => {}); }
  return traad;
}
async function saetForumTag(kanal, tagNavn) {
  try {
    if (!kanal?.isThread?.() || !kanal.parent) return;
    const id = tagId(kanal.parent, tagNavn); if (!id) return;
    if (kanal.archived) await kanal.setArchived(false).catch(() => {});
    await kanal.setAppliedTags([id]);
  } catch (e) { console.error('Forum-tag:', e.message); }
}
async function opretFejlTraad(guild, ticketKanal, bruger) {
  const forum = config.kanaler.fejlforum && await guild.channels.fetch(config.kanaler.fejlforum).catch(() => null);
  if (!forum || forum.type !== ChannelType.GuildForum) return;
  const traad = await forum.threads.create({ name: `Fejlrapport · ${bruger.username}`.slice(0, 90), appliedTags: [tagId(forum, 'Ny')].filter(Boolean),
    message: { content: `🐛 Ny fejlrapport fra **${bruger.username}**\nTicket: ${ticketKanal}\nSkift tag, når I går i gang eller er færdige.` } }).catch(e => { console.error('Fejl-tråd:', e.message); return null; });
  if (traad) { config.fejltraade = config.fejltraade || {}; config.fejltraade[ticketKanal.id] = traad.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); }
}
async function afslutFejlTraad(guild, ticketKanalId) {
  const tid = config.fejltraade?.[ticketKanalId]; if (!tid) return;
  const t = await client.channels.fetch(tid).catch(() => null);
  if (t) { await saetForumTag(t, 'Løst'); await t.send('✅ Ticketten er lukket – fejlrapporten er løst.').catch(() => {}); await t.setArchived(true).catch(() => {}); }
  delete config.fejltraade[ticketKanalId]; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}
// Onboarding: nye vælger selv, hvad de vil have ping om (giver rollerne automatisk)
// Åben "Velkommen"-kategori: Discord kræver mindst 5 skrivbare standardkanaler til onboarding, og resten af serveren er låst
const AABEN_KAT = '👋┃Velkommen';
const AABNE_KANALER = [['💬┃snak', 'Kun for nye: sig hej, indtil du er blevet spiller. Så får du adgang til de rigtige kanaler.'], ['❓┃spørgsmål', 'Spørg om serveren, reglerne eller spillet'], ['🎮┃find-spillere', 'Find nogen at spille med'], ['📸┃screenshots', 'Del billeder fra serveren'], ['😂┃sjov', 'Sjove billeder og klip']];
async function opsaetAabenKategori(guild) {
  const alle = guild.roles.everyone;
  let kat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === AABEN_KAT);
  if (!kat) kat = await guild.channels.create({ name: AABEN_KAT, type: ChannelType.GuildCategory, position: 0, permissionOverwrites: [{ id: alle.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions] }] }).catch(e => { console.error('Åben kategori:', e.message); return null; });
  if (!kat) return [];
  const ids = [];
  for (const [navn, emne] of AABNE_KANALER) {
    let k = guild.channels.cache.find(c => c.parentId === kat.id && c.name === navn);
    if (!k) k = await guild.channels.create({ name: navn, type: ChannelType.GuildText, parent: kat.id, topic: emne, rateLimitPerUser: 10, permissionOverwrites: [{ id: alle.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AddReactions], deny: [P.MentionEveryone] }], reason: 'Standardkanal til onboarding' }).catch(e => { console.error('Åben kanal ' + navn + ':', e.message); return null; });
    if (k) ids.push(k.id);
  }
  return ids;
}
// De åbne Velkommen-kanaler er kun til nye: skjul dem for Spiller-rollen, så verificerede ikke ser dem som dubletter af de rigtige kanaler
async function skjulAabenForSpillere(guild) {
  const kat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === AABEN_KAT);
  const spiller = config.roller && guild.roles.cache.get(config.roller['Spiller']);
  if (!kat || !spiller) return;
  for (const c of [kat, ...guild.channels.cache.filter(c => c.parentId === kat.id).values()]) {
    if (c.permissionOverwrites.cache.get(spiller.id)?.deny.has(P.ViewChannel)) continue;
    await c.permissionOverwrites.edit(spiller, { ViewChannel: false }, { reason: 'Velkommen-kanaler er kun til nye' }).catch(e => console.error('Skjul Velkommen:', e.message));
  }
}
async function opsaetOnboarding(guild) {
  config.community = config.community || {};
  if (config.community.onboarding === 7) return;
  await guild.roles.fetch();
  // [rollenavn, farve, titel, beskrivelse, emoji]
  const SPOERGSMAAL = [
    { titel: 'Hvad vil du have besked om?', enkelt: false, valg: [
      ['Nyheder', 0xa855f7, 'Nyheder og opdateringer', 'Ping når der er nyt på serveren', '📢'],
      ['Dev-Log', 0x94a3b8, 'Dev-log', 'Ping når der er nyt i #dev-log', '🛠️'],
      ['Events', 0xfbbf24, 'Events og turneringer', 'Ping ved events og ugens top', '🎉'],
      ['Giveaway', 0xf472b6, 'Giveaways', 'Ping ved nye giveaways', '🎁'],
      ['Konkurrence', 0xfacc15, 'Konkurrencer', 'Ping ved konkurrencer', '🏆'] ] },
    { titel: 'Hvilket kit spiller du mest?', enkelt: false, valg: [
      ['Diamond-kit', 0x22d3ee, 'Diamond', 'Diamantsværd og diamantrustning', '💎'],
      ['Rogue-kit', 0x94a3b8, 'Rogue', 'Chainmail, guldsværd og sukker', '🗡️'],
      ['Archer-kit', 0xa16207, 'Archer', 'Læderrustning og bue', '🏹'],
      ['Bard-kit', 0xeab308, 'Bard', 'Guldrustning, blaze powder og diamantsværd', '🎶'] ] },
    { titel: 'Hvad er du bedst til?', enkelt: false, valg: [
      ['Kriger', 0xef4444, 'Kriger', 'Jeg elsker PvP og at tage fights', '⚔️'],
      ['Bygmester', 0x3b82f6, 'Bygmester', 'Jeg bygger baser og claims', '🏗️'],
      ['Strateg', 0x8b5cf6, 'Strateg', 'Jeg planlægger raids og teamtaktik', '🧠'],
      ['Content', 0xec4899, 'Content', 'Jeg streamer eller laver videoer', '🎥'] ] },
    { titel: 'Hvornår spiller du helst?', enkelt: true, valg: [
      ['Morgenfugl', 0xfb923c, 'Morgen', 'Jeg spiller før middag', '🌅'],
      ['Eftermiddag', 0x4ade80, 'Eftermiddag', 'Jeg spiller efter skole eller arbejde', '☀️'],
      ['Nattugle', 0x6366f1, 'Aften og nat', 'Jeg spiller sent', '🦉'] ] },
  ];
  const rolleId = async ([n, c]) => (guild.roles.cache.find(r => r.name === n)
    || await guild.roles.create({ name: n, color: c, mentionable: false, hoist: false, permissions: [], reason: 'Onboarding-rolle' }).catch(e => { console.error('Onboarding-rolle ' + n + ':', e.message); return null; }))?.id;
  let nr = 0;
  const prompts = [];
  for (const [pi, sp] of SPOERGSMAAL.entries()) {
    const options = [];
    for (const v of sp.valg) {
      const id = await rolleId(v); if (!id) continue;
      options.push({ id: String(1180000000000000000n + BigInt(++nr)), title: v[2], description: v[3], emoji_name: v[4], role_ids: [id], channel_ids: [] });
    }
    if (options.length) prompts.push({ id: String(1180000000000000100n + BigInt(pi)), type: 0, title: sp.titel, single_select: sp.enkelt, required: false, in_onboarding: true, options });
  }
  const botsR = guild.roles.cache.find(r => r.name === 'Bots' && !r.managed);
  if (botsR) await botsR.setPosition(1).catch(() => {});
  if (!prompts.length) return;
  const k = config.kanaler;
  const aabne = await opsaetAabenKategori(guild);
  const synlige = [...aabne, k.velkommen, k.regler].filter(id => id && guild.channels.cache.has(id) && guild.channels.cache.get(id).permissionsFor(guild.roles.everyone)?.has(P.ViewChannel));
  const body = { enabled: true, mode: 0, default_channel_ids: synlige, prompts };
  await guild.client.rest.put(`/guilds/${guild.id}/onboarding`, { body })
    .then(() => { config.community.onboarding = 7; fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); console.log(`Onboarding: ${prompts.length} spørgsmål er sat.`); })
    .catch(e => console.log('Onboarding kunne ikke sættes automatisk – slå den til under Server Settings → Onboarding:', e.message, JSON.stringify(e.rawError?.errors || '').slice(0, 300)));
}
// Server-emojis, soundboard-lyde og rolleikoner (kører én gang hver; rolleikoner kræver boost-niveau 2)
async function opsaetPynt(guild, tving = false) {
  config.pynt = config.pynt || {};
  const rap = { nye: 0, fejl: [] };
  // Mine egne HopDop-/Hoppe-emojis er fjernet (du ville ikke have dem) - slet dem fra serveren og opret dem ikke igen
  if (tving || config.pynt.emojisV !== 6) {
    await guild.emojis.fetch();
    let slettet = 0;
    for (const e of guild.emojis.cache.values()) if (e.name.startsWith('hopdop_') || e.name.startsWith('hoppe_')) { await e.delete('Fjernet efter ønske').then(() => slettet++).catch(err => rap.fejl.push(`${e.name}: ${err.message}`)); }
    if (!rap.fejl.length) config.pynt.emojisV = 6;
    console.log(`Pynt: ${slettet} af mine egne emojis er slettet.`);
  }
  if (!config.pynt.lyde) {
    for (const [navn, l] of Object.entries(EKSTRA_DATA.lyde)) {
      await guild.client.rest.post(`/guilds/${guild.id}/soundboard-sounds`, { body: { name: navn, sound: `data:audio/mpeg;base64,${l.data}`, volume: 1, emoji_name: l.emoji } })
        .then(() => console.log(`Pynt: soundboard-lyd ${navn} oprettet.`)).catch(e => console.error(`Lyd ${navn}:`, e.message));
    }
    config.pynt.lyde = true;
  }
  // Rolleikoner: egne pixel-ikoner (assets/roller/*.png). Discord kræver boost-niveau 2.
  const IKON_V = 2;
  if (guild.premiumTier >= 2 && config.pynt.ikonerV !== IKON_V) {
    const filer = { ejer: 'ejer', admin: 'admin', mod: 'mod', 'hjælper': 'hjaelper', builder: 'builder', event: 'event', partner: 'partner', streamer: 'streamer', legende: 'legende', mester: 'mester', diamant: 'diamant', guld: 'guld', 'sølv': 'soelv', bronze: 'bronze', spiller: 'spiller' };
    await guild.roles.fetch();
    let sat = 0;
    for (const r of guild.roles.cache.values()) {
      const f = filer[r.name.toLowerCase()]; const sti = f && `assets/roller/${f}.png`;
      if (sti && fs.existsSync(sti)) await r.setIcon(sti, 'HopDop rolleikon').then(() => sat++).catch(e => rap.fejl.push(`rolleikon ${r.name}: ${e.message}`));
    }
    if (!rap.fejl.some(x => x.startsWith('rolleikon'))) config.pynt.ikonerV = IKON_V;
    console.log(`Pynt: ${sat} rolleikoner er sat.`);
  } else if (guild.premiumTier < 2 && config.pynt.ikonerV !== IKON_V) console.log('Pynt: rolleikoner springes over (kræver boost-niveau 2) – de sættes automatisk, når serveren når det.');
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  return rap;
}
// /event: planlagt Discord-event i Event-talerummet
async function opretEvent(i) {
  const titel = i.options.getString('titel'), minutter = i.options.getInteger('starter_om'), varighed = i.options.getInteger('varighed') || 60;
  const type = i.options.getString('type') || 'Event', besk = i.options.getString('beskrivelse') || `${type} på HopDop! Kom og vær med – join Event-talerummet, når det starter.`;
  const rum = i.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === EVENT_RUM);
  if (!rum) return i.reply({ content: 'Fandt ikke Event-talerummet.', flags: MessageFlags.Ephemeral });
  const start = new Date(Date.now() + minutter * 60000), slut = new Date(start.getTime() + varighed * 60000);
  const ev = await i.guild.scheduledEvents.create({ name: `${type === 'Event' ? '🎪' : type === 'KOTH' ? '👑' : type === 'Giveaway' ? '🎁' : '🏆'} ${titel}`.slice(0, 100), scheduledStartTime: start, scheduledEndTime: slut,
    privacyLevel: 2, entityType: 2, channel: rum.id, description: besk.slice(0, 1000), reason: `Event af ${i.user.username}` }).catch(e => { console.error('Event:', e.message); return null; });
  if (!ev) return i.reply({ content: 'Kunne ikke oprette eventet. Botten mangler måske rettigheden **Manage Events**.', flags: MessageFlags.Ephemeral });
  const kanal = config.kanaler.events && await i.guild.channels.fetch(config.kanaler.events).catch(() => null);
  if (kanal) sendPing(kanal, 'Events', { content: undefined, embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle(`🎪 Nyt event: ${titel}`).setDescription(`${besk}\n\n⏰ Starter <t:${Math.floor(start.getTime() / 1000)}:R> (<t:${Math.floor(start.getTime() / 1000)}:t>)\n🔊 ${rum}\n➡️ Tryk **Interesseret** på eventet: ${ev.url}`)] }).catch(() => {});
  return i.reply({ content: `✅ Eventet er oprettet: ${ev.url}`, flags: MessageFlags.Ephemeral });
}
// ================= GOONS-ROLLEN (kun to personer må dele den ud) =================
const GOONS_UDDELERE = ['328615599641067527', '500265348721803266'];
const goonsRolle = guild => guild.roles.cache.find(r => r.name === 'Goons');
async function opsaetGoons(guild) {
  await guild.roles.fetch();
  if (goonsRolle(guild)) return;
  await guild.roles.create({ name: 'Goons', color: 0x7f1d1d, hoist: true, mentionable: false, permissions: [], reason: 'Goons-rolle' })
    .then(() => console.log('Goons-rollen er oprettet.')).catch(e => console.error('Goons-rolle:', e.message));
}
// Hvis andre end de to giver rollen på anden vis (Discord manuelt), fjerner botten den igen
client.on('guildMemberUpdate', async (gl, ny) => {
  try {
    const r = goonsRolle(ny.guild); if (!r || gl.roles.cache.has(r.id) || !ny.roles.cache.has(r.id)) return;
    if (goonsBotGiver.delete(ny.id)) return;
    let udfoerer = null;
    const log = await ny.guild.fetchAuditLogs({ type: 25, limit: 6 }).catch(() => null); // MemberRoleUpdate
    const e = log?.entries.find(x => x.target?.id === ny.id && Date.now() - x.createdTimestamp < 15000 && x.changes?.some(c => c.key === '$add' && c.new?.some(o => o.id === r.id)));
    udfoerer = e?.executorId;
    if (udfoerer && (GOONS_UDDELERE.includes(udfoerer) || udfoerer === client.user.id)) return;
    await ny.roles.remove(r, 'Kun to personer må give Goons').catch(() => {});
    console.log(`Goons: rollen blev fjernet fra ${ny.user.username} (givet af ${udfoerer || 'ukendt'}).`);
  } catch (e) { console.error('Goons-vagt:', e.message); }
});
const goonsBotGiver = new Set();
// ================= EGNE EMOJIS FRA MAPPEN "emojis" =================
// Læg PNG/JPG/GIF-filer (max 256 KB) i mappen "emojis" ved siden af index.js. Filnavnet bliver emojiens navn.
const ASCII_NAVN = n => n.replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/Æ/g, 'Ae').replace(/Ø/g, 'Oe').replace(/Å/g, 'Aa');
// Prøver først med æ/ø/å i navnet; afviser Discord det, bruges ae/oe/aa som nødløsning
async function opretEmoji(guild, navn, data, reason) {
  try { return await guild.emojis.create({ attachment: data, name: navn, reason }); }
  catch (e) { if (ASCII_NAVN(navn) === navn) throw e; return guild.emojis.create({ attachment: data, name: ASCII_NAVN(navn), reason }); }
}
const EMOJI_MAPPE = 'emojis';
// Forståelige navne ud fra, hvad billedet viser (nøgle = filnavn uden endelse og tal-præfiks)
const EMOJI_NAVNE = { crying: 'frø_græder', pepehammer: 'frø_hammer', noo: 'noo_græder', sad: 'frø_trist', pepe: 'frø_hænder_op', pepebless: 'frø_beder',
  pepestare: 'frø_stirrer', pepeplusone: 'frø_plus_en', thumbsupcat: 'kat_tommel_op', pepedepressed: 'frø_deprimeret', pepegoogoo: 'frø_baby', pepehappy: 'frø_glad' };
const EMOJI_SPRING = ['pepehang']; // viser selvskade (galge) - tilføjes aldrig
async function opsaetEmojiMappe(guild) {
  if (!fs.existsSync(EMOJI_MAPPE)) { fs.mkdirSync(EMOJI_MAPPE); fs.writeFileSync(`${EMOJI_MAPPE}/LÆS-MIG.txt`, 'Læg PNG-, JPG- eller GIF-filer her (max 256 KB pr. fil).\r\nFilnavnet bliver emojiens navn, fx sejt_sværd.png -> :sejt_sværd:\r\nSå skriver du /emojis på Discord, eller genstarter botten.\r\n'); }
  await guild.emojis.fetch();
  const resultat = { nye: [], sprunget: [], fejl: [] };
  for (const fil of fs.readdirSync(EMOJI_MAPPE)) {
    if (!/\.(png|jpe?g|gif)$/i.test(fil)) continue;
    const stamme = fil.replace(/\.[^.]+$/, '').replace(/^\d+[-_]/, '').toLowerCase();
    if (EMOJI_SPRING.includes(stamme)) { resultat.fejl.push(`${fil} (springet over: viser selvskade)`); continue; }
    const navn = EMOJI_NAVNE[stamme] || stamme.replace(/[^a-zA-Z0-9_æøåÆØÅ]/g, '_').slice(0, 32);
    if (navn.length < 2) { resultat.fejl.push(`${fil} (navnet er for kort)`); continue; }
    if (guild.emojis.cache.some(e => e.name === navn || e.name === ASCII_NAVN(navn))) { resultat.sprunget.push(navn); continue; }
    const data = fs.readFileSync(`${EMOJI_MAPPE}/${fil}`);
    if (data.length > 256 * 1024) { resultat.fejl.push(`${fil} (over 256 KB)`); continue; }
    await opretEmoji(guild, navn, data, 'Egen emoji fra mappen').then(() => resultat.nye.push(navn)).catch(e => resultat.fejl.push(`${fil} (${e.message})`));
  }
  if (resultat.nye.length) console.log(`Emojis: ${resultat.nye.length} egne emojis tilføjet: ${resultat.nye.join(', ')}`);
  return resultat;
}
async function opsaetRettigheder(guild) {
  await guild.roles.fetch();
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  // Spiller: egen sektion i medlemslisten, og ingen @everyone/@here/rolle-pings (kun enkelte spillere)
  if (spiller) {
    const p = spiller.permissions.remove(P.MentionEveryone);
    await spiller.edit({ hoist: true, permissions: p }).catch(e => console.error('Spiller-rolle:', e.message));
  }
  // Botten: rollen "Bots" nederst i medlemslisten (under alle andre roller, ikke under "Online")
  const botRolle = guild.members.me.roles.botRole;
  if (botRolle && botRolle.hoist) await botRolle.edit({ hoist: false }).catch(e => console.error('Bot-rolle:', e.message));
  let botsRolle = guild.roles.cache.find(r => r.name === 'Bots' && !r.managed);
  if (!botsRolle) botsRolle = await guild.roles.create({ name: 'Bots', color: 0x4ade80, hoist: true, mentionable: false, permissions: [], reason: 'Bots-rolle' }).catch(e => { console.error('Bots-rolle:', e.message); return null; });
  if (botsRolle) {
    if (!botsRolle.hoist) await botsRolle.edit({ hoist: true }).catch(() => {});
    if (botsRolle.position !== 1) await botsRolle.setPosition(1).catch(e => console.error('Bots-position:', e.message));
    if (!guild.members.me.roles.cache.has(botsRolle.id)) await guild.members.me.roles.add(botsRolle).catch(e => console.error('Bots-tildeling:', e.message));
  }
  await laasPings(guild);
  await laasLaeseKanaler(guild);
  await saetSlowmode(guild);
  // #ansøgninger: kun læsning for spillere + knapper til hjemmesiden
  const ansog = config.kanaler.ansog && await guild.channels.fetch(config.kanaler.ansog).catch(() => null);
  if (ansog) {
    await ansog.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false }).catch(() => {});
    if (spiller) await ansog.permissionOverwrites.edit(spiller.id, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false }).catch(() => {});
    await opdaterPanel(ansog, '📝 Ansøgninger', {
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📝 Ansøgninger')
        .setDescription('Vil du være en del af holdet? Ansøg på vores hjemmeside – tryk på en knap herunder.\nDu hører fra staff, når din ansøgning er læst.')
        .setFooter({ text: 'HOPDOP · hopdop.pages.dev' })],
      components: [new ActionRowBuilder().addComponents(ANSOG_LINKS.map(([n, t, e]) => new ButtonBuilder().setLabel(n).setEmoji(e).setStyle(ButtonStyle.Link).setURL(`${WEB}/ansog.html?type=${t}`)))],
    });
  }
  // #forslag: spillere kan kun reagere. Forslag laves med /forslag i #bot-kommandoer
  const fo = config.kanaler.forslag && await guild.channels.fetch(config.kanaler.forslag).catch(() => null);
  if (fo) {
    const lås = { SendMessages: false, AddReactions: true, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false };
    await fo.permissionOverwrites.edit(guild.roles.everyone.id, lås).catch(() => {});
    if (spiller) await fo.permissionOverwrites.edit(spiller.id, lås).catch(() => {});
    await fo.setTopic(`Stem på forslag med reaktioner. Lav et forslag: gå ind i #bot-kommandoer og skriv /forslag`).catch(() => {});
    const info = await opdaterPanel(fo, '💡 Sådan laver du et forslag', {
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('💡 Sådan laver du et forslag')
        .setDescription(`Gå ind i <#${config.kanaler.botcmd}> og skriv **/forslag** for at lave et forslag.\nHer i kanalen kan du stemme med reaktioner på andres forslag.`)],
    });
    if (info?.pin && !info.pinned) info.pin().catch(() => {});
  }
  // Ticket-panel med fejlrapport
  const tk = config.kanaler.ticket && await guild.channels.fetch(config.kanaler.ticket).catch(() => null);
  if (tk) await opdaterPanel(tk, '🎫 Support', {
    embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎫 Support')
      .setDescription('Har du brug for hjælp? Vælg en kategori nedenfor, så opretter jeg en privat kanal til dig og staff.\n\n🐞 **Fundet en fejl?** Tryk på *Fejlrapport* og fortæl, hvad der gik galt.')],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:support').setLabel('Support').setEmoji('🛟').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:koeb').setLabel('Køb / Ranks').setEmoji('💳').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket:ansoeg').setLabel('Ansøgning').setEmoji('📝').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket:fejl').setLabel('Anmeld spiller').setEmoji('🚨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket:bug').setLabel('Fejlrapport').setEmoji('🐞').setStyle(ButtonStyle.Secondary))],
  });
  console.log('Rettigheder, bot-rolle og paneler er opdateret.');
}

// ================= SUPPORT-RUM OG AKTIVE TICKETS =================
const SUPPORT_RUM = [1, 2, 3, 4, 5].map(n => `⛔┃Support ${n}`);
const gammelSupportNavn = n => n.replace('⛔', '🎧');
const VENTE_RUM = '⏳┃Afventer support';
const PRIVAT_KAT = '[ 🔐 ] PRIVATE RUM';
const PRIVAT_KANAL = '🔐┃opret-privat-rum';
const TILKALD_KANAL = '🔔┃support-afventer';
const TALE_NAVNE = {};
for (const [nyt, gamle] of [['💬┃Hyggesnak 1', ['🔊 Lounge', '💬┃Hyggesnak', '🔊 Snak', '🔊 Snakkerum 1', '🔊┃Snakkerum 1']],
  ['💬┃Hyggesnak 2', ['🎮 Duo 1', '🎮┃Makkerrum 1', '🎮 Gaming 1', '🔊 Snakkerum 2']], ['💬┃Hyggesnak 3', ['🎮 Duo 2', '🎮┃Makkerrum 2', '🎮 Gaming 2', '🔊 Snakkerum 3']],
  ['🎪┃Event', ['🎪 Event', '🎪┃Eventrum']]]) for (const g of gamle) TALE_NAVNE[g] = nyt;
const GAMLE_NAVNE = TALE_NAVNE;
const EVENT_RUM = '🎪┃Event';
const EVENT_PODIUM = '🎤┃Event-podium';
// Normale navne til talekanalerne + Event og Event-podium (til staff) øverst i kategorien
async function opsaetTaleNavne(guild) {
  await guild.channels.fetch();
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  const staffOw = STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.Connect, P.Speak, P.MoveMembers, P.MuteMembers, P.RequestToSpeak] }));
  let kat = null;
  for (const c of guild.channels.cache.values()) {
    if (c.type === ChannelType.GuildVoice && TALE_NAVNE[c.name]) {
      if (c.name !== TALE_NAVNE[c.name]) await c.setName(TALE_NAVNE[c.name]).catch(() => {});
      kat = kat || c.parentId;
    }
  }
  if (!kat) { const k = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && /SNAKKE/i.test(c.name)); kat = k && k.id; }
  if (!kat) return;
  const aabent = [{ id: guild.roles.everyone.id, allow: [P.ViewChannel, P.Connect, P.Speak] }, ...staffOw];
  let ev = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === EVENT_RUM);
  if (!ev) ev = await guild.channels.create({ name: EVENT_RUM, type: ChannelType.GuildVoice, parent: kat, permissionOverwrites: aabent }).catch(e => { console.error('Event-rum:', e.message); return null; });
  // Podium: rigtig Stage-kanal. Staff (moderatorer) starter scenen og inviterer op; alle andre lytter og kan række hånden op.
  const modOw = STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.Connect, P.Speak, P.MoveMembers, P.MuteMembers, P.ManageChannels, P.RequestToSpeak] }));
  const podOw = [{ id: guild.roles.everyone.id, allow: [P.ViewChannel, P.Connect, P.RequestToSpeak], deny: [P.Speak] }, ...modOw];
  let pod = guild.channels.cache.find(c => (c.name === EVENT_PODIUM || c.name === '🎤 Event-podium') && c.type === ChannelType.GuildStageVoice);
  if (pod && pod.name !== EVENT_PODIUM) await pod.setName(EVENT_PODIUM).catch(() => {});
  const gammelPod = guild.channels.cache.find(c => c.name === EVENT_PODIUM && c.type !== ChannelType.GuildStageVoice);
  if (gammelPod) await gammelPod.delete('Erstattes af rigtig Stage-kanal').catch(() => {});
  if (!pod) pod = await guild.channels.create({ name: EVENT_PODIUM, type: ChannelType.GuildStageVoice, parent: kat, permissionOverwrites: podOw })
    .catch(e => { console.error('Event-podium (kræver at Community er slået til):', e.message); return null; });
  else await pod.permissionOverwrites.set(podOw).catch(() => {});
  if (ev && ev.parentId !== kat) await ev.setParent(kat, { lockPermissions: false }).catch(() => {});
  if (pod && pod.parentId !== kat) await pod.setParent(kat, { lockPermissions: false }).catch(() => {});
  const poser = [ev, pod].filter(Boolean).map((c, i) => ({ channel: c.id, position: i }));
  await guild.channels.setPositions(poser).catch(e => console.error('Tale-rækkefølge:', e.message));
  console.log('Talekanaler: Event og Event-podium (Stage) øverst.');
}
const AKTIVE_KAT = '🎫 AKTIVE TICKETS';
const AKTIVE_KANAL = '📋┃aktive-tickets';
async function opsaetSupport(guild) {
  await guild.channels.fetch(); await guild.roles.fetch();
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  const staffOw = STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.Connect, P.Speak, P.MoveMembers, P.MuteMembers, P.ReadMessageHistory] }));
  // Support 1-5: spillere kan IKKE joine selv - staff trækker dem ned fra "Afventer support"
  const sup = config.kanaler.support;
  const spillerSup = spiller ? [{ id: spiller.id, allow: [P.ViewChannel, P.Speak, P.UseVAD], deny: [P.Connect] }] : [];
  for (const navn of SUPPORT_RUM) {
    const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel, P.Connect] }, ...spillerSup, ...staffOw];
    const fundet = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.parentId === sup && (c.name === navn || c.name === gammelSupportNavn(navn)));
    if (fundet) { if (fundet.name !== navn) await fundet.setName(navn).catch(() => {}); await fundet.permissionOverwrites.set(ow).catch(() => {}); }
    else await guild.channels.create({ name: navn, type: ChannelType.GuildVoice, parent: sup, permissionOverwrites: ow }).catch(e => console.error('Support-rum:', e.message));
  }
  // Ventrum: her joiner spillerne og venter på staff
  const venteOw = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, ...(spiller ? [{ id: spiller.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.UseVAD] }] : []), ...staffOw];
  const vente = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === VENTE_RUM);
  if (vente) await vente.permissionOverwrites.set(venteOw).catch(() => {});
  else await guild.channels.create({ name: VENTE_RUM, type: ChannelType.GuildVoice, parent: sup, position: 0, permissionOverwrites: venteOw }).catch(e => console.error('Ventrum:', e.message));
  // Tilkald-kanal: spillere kan tilkalde staff med en knap (5 min cooldown)
  let tk = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.parentId === sup && (c.name === TILKALD_KANAL || c.name === TILKALD_KANAL.toLowerCase().replace(/ /g, '-')));
  const tkOw = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] },
    ...(spiller ? [{ id: spiller.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads, P.CreatePrivateThreads] }] : []),
    ...STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }))];
  if (tk) await tk.permissionOverwrites.set(tkOw).catch(() => {});
  else tk = await guild.channels.create({ name: TILKALD_KANAL, type: ChannelType.GuildText, parent: sup, topic: 'Brug knappen for at tilkalde staff. Gå derefter ind i "Afventer support" i talekanalerne.', permissionOverwrites: tkOw }).catch(e => { console.error('Tilkald-kanal:', e.message); return null; });
  if (tk) {
    config.kanaler.tilkald = tk.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    await opdaterPanel(tk, '🔔 Support afventer', {
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🔔 Support afventer')
        .setDescription('Har du brug for hjælp af en fra staff?\n\n**1.** Tryk på knappen og skriv kort, hvad du har brug for hjælp til.\n**2.** Gå ind i talekanalen **⏳┃Afventer support**.\n**3.** En fra staff trækker dig ned i et support-rum.\n\nDu kan tilkalde staff hver 5. minut.')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tilkald').setLabel('Tilkald staff').setEmoji('🔔').setStyle(ButtonStyle.Success))],
    });
  }
  await opsaetStaffKanaler(guild);
  await opsaetAdmin(guild);
  await opsaetStaffTale(guild);
  await opsaetPrivat(guild);
  await engangsOprydning(guild);
  await opsaetTaleNavne(guild).catch(e => console.error('opsaetTaleNavne:', e.message));
  await opsaetCommunity(guild).catch(e => console.error('opsaetCommunity:', e.message));
  await opsaetForummer(guild).catch(e => console.error('opsaetForummer:', e.message));
  await opsaetOnboarding(guild).catch(e => console.error('opsaetOnboarding:', e.message));
  await skjulAabenForSpillere(guild).catch(e => console.error('skjulAaben:', e.message));
  await opsaetPynt(guild).catch(e => console.error('opsaetPynt:', e.message));
  await opsaetGoons(guild).catch(e => console.error('opsaetGoons:', e.message));
  await opsaetEmojiMappe(guild).catch(e => console.error('Emoji-mappe:', e.message));
  // Opdel kanalerne automatisk (én gang pr. layout-version). /layout fortryd sætter det tilbage.
  if (config.layoutVersion !== LAYOUT_VERSION) {
    const r = await layoutAnvend(guild).catch(e => { console.error('Layout:', e.message); return null; });
    if (r) { config.layoutVersion = LAYOUT_VERSION; fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); console.log(`Layout: ${r.flyttet} kanaler er opdelt i ${r.kategorier} kategorier.`); }
  }
  // Screenshare: kun dem med rollen (staff + midlertidigt), alle andre mister Stream-rettigheden
  await opsaetScreenshare(guild);
  // Staff-kategori med liste over aktive tickets
  let kat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === AKTIVE_KAT);
  const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] },
    ...STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] }))];
  if (!kat) kat = await guild.channels.create({ name: AKTIVE_KAT, type: ChannelType.GuildCategory, permissionOverwrites: ow }).catch(e => { console.error('Aktive tickets:', e.message); return null; });
  if (!kat) return;
  let k = guild.channels.cache.find(c => c.parentId === kat.id && c.name === AKTIVE_KANAL.toLowerCase().replace(/ /g, '-')) || guild.channels.cache.find(c => c.parentId === kat.id && c.name === AKTIVE_KANAL);
  if (!k) k = await guild.channels.create({ name: AKTIVE_KANAL, type: ChannelType.GuildText, parent: kat.id, topic: 'Alle åbne tickets og folk der venter i support-rum. Opdateres automatisk. Kun staff.', permissionOverwrites: ow });
  config.kanaler.aktive = k.id; config.kanaler.aktivkat = kat.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  // #fejlrapporter: ingen skriver mere - man opretter en fejlrapport-ticket i stedet
  const fejl = config.kanaler.fejl && await guild.channels.fetch(config.kanaler.fejl).catch(() => null);
  if (fejl) {
    const lås = { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false };
    await fejl.permissionOverwrites.edit(guild.roles.everyone.id, lås).catch(() => {});
    if (spiller) await fejl.permissionOverwrites.edit(spiller.id, lås).catch(() => {});
    await opdaterPanel(fejl, '🐞 Fejlrapporter', {
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🐞 Fejlrapporter')
        .setDescription('Fundet en fejl? Tryk på knappen, så opretter jeg en privat ticket til dig og staff.\nHer i kanalen kan man ikke skrive.')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:bug').setLabel('Opret fejlrapport').setEmoji('🐞').setStyle(ButtonStyle.Danger))],
    });
  }
  await opdaterAktive(guild);
}
let aktiveTid = 0;
async function opdaterAktive(guild) {
  try {
    guild = guild || await client.guilds.fetch(process.env.GUILD_ID);
    const k = config.kanaler.aktive && await guild.channels.fetch(config.kanaler.aktive).catch(() => null);
    if (!k) return;
    await guild.channels.fetch();
    const tickets = guild.channels.cache.filter(c => c.type === ChannelType.GuildText && String(c.topic || '').startsWith('ticket:')).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    // Åbne tickets ligger i kategorien AKTIVE TICKETS (også dem, der blev oprettet før)
    if (config.kanaler.aktivkat) for (const t of tickets.values()) if (t.parentId !== config.kanaler.aktivkat) await t.setParent(config.kanaler.aktivkat, { lockPermissions: false }).catch(() => {});
    const linjer = [...tickets.values()].slice(0, 25).map(c => `${[...c.name][0]} ${c} · <@${c.topic.replace('ticket:', '')}> · åbnet <t:${Math.floor(c.createdTimestamp / 1000)}:R>`);
    const rum = SUPPORT_RUM.map(n => {
      const v = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === n);
      if (!v) return null;
      const folk = [...v.members.values()].map(m => m.toString());
      return `${folk.length ? '🔴' : '🟢'} ${v} · ${folk.length ? folk.join(', ') : 'ledigt'}`;
    }).filter(Boolean);
    const vv = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === VENTE_RUM);
    const ventende = vv ? [...vv.members.values()].map(m => m.toString()) : [];
    rum.unshift(`${ventende.length ? '🟠' : '⚪'} ${vv || VENTE_RUM} · ${ventende.length ? `**${ventende.length} venter:** ${ventende.join(', ')}` : 'ingen venter'}`);
    const venter = ventende.length > 0 || rum.some(r => r.startsWith('🔴'));
    const emb = new EmbedBuilder().setColor(tickets.size || venter ? 0xf59e0b : 0x57f287).setTitle('📋 Aktive tickets')
      .setDescription(tickets.size ? linjer.join('\n') : '✅ Ingen åbne tickets lige nu.')
      .addFields({ name: '🎧 Support-rum', value: rum.join('\n') || 'Ingen support-rum fundet.' })
      .setFooter({ text: `${tickets.size} ${tickets.size === 1 ? 'åben ticket' : 'åbne tickets'} · opdateres automatisk` }).setTimestamp();
    await opdaterPanel(k, '📋 Aktive tickets', { embeds: [emb] });
  } catch (e) { console.error('Aktive tickets:', e.message); }
}
// Når en spiller joiner et support-rum, får staff en besked (og listen opdateres)
client.on('voiceStateUpdate', async (gl, ny) => {
  if (gl.channelId === ny.channelId) return;
  const rum = ny.channel && ny.channel.name === VENTE_RUM ? ny.channel : null;
  if (rum && !ny.member.user.bot) {
    const alarmId = config.kanaler.alarmer || config.kanaler.aktive;
    const k = alarmId ? await ny.guild.channels.fetch(alarmId).catch(() => null) : null;
    const besked = await k?.send({ content: `🔔 ${ny.member} venter i ${rum} – træk dem ned i et support-rum.`, allowedMentions: { parse: [] } }).catch(() => null);
    if (besked) setTimeout(() => besked.delete().catch(() => {}), 10 * 60000);
  }
  if (Date.now() - aktiveTid > 2000) { aktiveTid = Date.now(); setTimeout(() => opdaterAktive(), 1500); }
});

// ================= SCREENSHARE-ROLLE (midlertidig) =================
const SS_FIL = 'screenshare.json';
let ssData = (() => { try { return JSON.parse(fs.readFileSync(SS_FIL, 'utf8')); } catch { return {}; } })(); // brugerId -> udløb (ms)
const gemSs = () => fs.writeFileSync(SS_FIL, JSON.stringify(ssData));
async function ssRolle(guild) {
  await guild.roles.fetch();
  return guild.roles.cache.find(r => r.name === 'Screenshare')
    || await guild.roles.create({ name: 'Screenshare', color: 0x06b6d4, permissions: [P.Stream], mentionable: false, hoist: false, reason: 'HOPDOP screenshare' }).catch(e => { console.error('Screenshare-rolle:', e.message); return null; });
}
async function opsaetScreenshare(guild) {
  const ss = await ssRolle(guild); if (!ss) return;
  const ev = guild.roles.everyone;
  if (ev.permissions.has(P.Stream)) await ev.setPermissions(ev.permissions.remove(P.Stream)).catch(() => {});
  for (const r of guild.roles.cache.values()) {
    if (r.id === ev.id || r.managed || r.id === ss.id) continue;
    const staff = STAFF.includes(r.id);
    if (staff && !r.permissions.has(P.Stream)) await r.setPermissions(r.permissions.add(P.Stream)).catch(() => {});
    if (!staff && r.permissions.has(P.Stream) && !r.permissions.has(P.Administrator)) await r.setPermissions(r.permissions.remove(P.Stream)).catch(() => {});
  }
}
async function tjekScreenshare() {
  const nu = Date.now();
  const udloebet = Object.entries(ssData).filter(([, t]) => t <= nu);
  if (!udloebet.length) return;
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const rolle = await ssRolle(guild); if (!rolle) return;
  for (const [id] of udloebet) {
    const m = await guild.members.fetch(id).catch(() => null);
    if (m) {
      await m.roles.remove(rolle, 'Screenshare udløbet').catch(() => {});
      if (m.voice?.channel && m.voice.streaming) await m.voice.setChannel(m.voice.channel).catch(() => {});
      m.send('⏱️ Din adgang til at screenshare på HOPDOP er udløbet.').catch(() => {});
    }
    delete ssData[id];
  }
  gemSs();
}
// ================= TILKALD STAFF (5 min cooldown) =================
const tilkaldCooldown = new Map(); // brugerId -> sidste gang
const TILKALD_VENT = 5 * 60000;
async function tilkaldStaff(i, grund) {
  const guild = i.guild;
  const alarmId = config.kanaler.alarmer || config.kanaler.aktive;
  const kanal = (alarmId ? await guild.channels.fetch(alarmId).catch(() => null) : null) || i.channel;
  const roller = ['Hjælper', 'Mod', 'Admin'].map(n => guild.roles.cache.find(r => r.name === n)).filter(Boolean);
  for (const r of roller) await r.setMentionable(true).catch(() => {});
  try {
    await kanal.send({ content: roller.map(r => `<@&${r.id}>`).join(' '), allowedMentions: { roles: roller.map(r => r.id) },
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🔔 Spiller har brug for hjælp')
        .setDescription(`${i.user} har tilkaldt staff.${grund ? `\n\n**Hvad:** ${grund}` : ''}\n\nTræk dem ned fra <#${(guild.channels.cache.find(c => c.name === VENTE_RUM) || {}).id || 'ventrum'}> når I er klar.`)] });
  } finally { for (const r of roller) r.setMentionable(false).catch(() => {}); }
}
// ================= LAYOUT: opdel kanalerne i pæne kategorier (/layout anvend | fortryd) =================
const LAYOUT_BACKUP = 'layout-backup.json';
const LAYOUT_VERSION = 6;
// Kategorier i rækkefølge (staff-kategorierne røres ikke). "gamle" = navne den kan have i forvejen. "kanaler" = nøgler i config.json eller navne på talekanaler.
const LAYOUT = [
  { navn: '[ 💡 ] INFORMATION', gamle: ['📌 INFORMATION'], kanaler: ['velkommen', 'regler', 'roller', 'botguide', 'serverip'] },
  { navn: '[ 📢 ] MEDDELELSER', gamle: [], kanaler: ['nyheder', 'events', 'devlog', 'serverstatus'] },
  { navn: '[ 🌟 ] COMMUNITY', gamle: ['💬 COMMUNITY'], kanaler: ['forslag', 'giveaways', 'leaderboards', 'boosts'] },
  { navn: '[ 💬 ] TEKST KANALER', gamle: [], kanaler: ['chat', 'medier', 'memes', 'botcmd'] },
  { navn: '[ 🔊 ] SNAKKE-KANALER', gamle: ['🔊 VOICE'], kanaler: ['🎪┃Event', '🎤┃Event-podium', '💬┃Hyggesnak 1', '💬┃Hyggesnak 2', '💬┃Hyggesnak 3', '🎪 Event', '🎤 Event-podium', '🔊 Snak', '🎮 Gaming 1', '🎮 Gaming 2', '🔊 Lounge', '🎮 Duo 1', '🎮 Duo 2', '💬┃Hyggesnak', '🎮┃Makkerrum 1', '🎮┃Makkerrum 2', '🎪┃Eventrum'] },
  { navn: PRIVAT_KAT, gamle: [], noegle: 'privatkat', kanaler: ['privatkanal'] },
  { navn: '[ 🎫 ] TICKETS & SUPPORT', gamle: ['🎫 SUPPORT'], noegle: 'support', kanaler: ['ticket', 'fejl', 'ansog', 'tilkald', VENTE_RUM, ...SUPPORT_RUM] },
];
async function layoutAnvend(guild) {
  await guild.channels.fetch();
  const alle = [...guild.channels.cache.values()];
  // Backup af hvordan det ser ud nu (så /layout fortryd kan sætte det tilbage)
  const backup = { tid: Date.now(), kanaler: alle.map(c => ({ id: c.id, navn: c.name, parent: c.parentId, pos: c.rawPosition, kat: c.type === ChannelType.GuildCategory })), oprettet: [] };
  const kat = []; // [{ladning, kategori}]
  for (const l of LAYOUT) {
    const navneSoeg = [l.navn, ...l.gamle].map(x => x.toLowerCase());
    let k = l.noegle && config.kanaler[l.noegle] ? guild.channels.cache.get(config.kanaler[l.noegle]) : null;
    if (!k) k = alle.find(c => c.type === ChannelType.GuildCategory && navneSoeg.includes(c.name.toLowerCase()));
    if (!k) { k = await guild.channels.create({ name: l.navn, type: ChannelType.GuildCategory }); backup.oprettet.push(k.id); }
    else if (k.name !== l.navn) await k.setName(l.navn).catch(e => console.error('Layout navn:', e.message));
    kat.push({ l, k });
  }
  // #memes findes måske ikke endnu: lav den med samme rettigheder som #chat
  if (!config.kanaler.memes || !guild.channels.cache.get(config.kanaler.memes)) {
    const chat = guild.channels.cache.get(config.kanaler.chat);
    const fundet = alle.find(c => c.type === ChannelType.GuildText && /memes/i.test(c.name));
    const m = fundet || await guild.channels.create({ name: '😂┃memes', type: ChannelType.GuildText, topic: 'Del dine bedste memes 😂', permissionOverwrites: chat ? [...chat.permissionOverwrites.cache.values()].map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny })) : [] }).catch(e => { console.error('#memes:', e.message); return null; });
    if (m) { config.kanaler.memes = m.id; backup.oprettet.push(...(fundet ? [] : [m.id])); fs.writeFileSync('config.json', JSON.stringify(config, null, 2)); }
  }
  if (fs.existsSync(LAYOUT_BACKUP)) { // behold den første backup, så fortryd går tilbage til det oprindelige
    const gl = JSON.parse(fs.readFileSync(LAYOUT_BACKUP, 'utf8')); gl.oprettet = [...new Set([...(gl.oprettet || []), ...backup.oprettet])]; fs.writeFileSync(LAYOUT_BACKUP, JSON.stringify(gl, null, 2));
  } else fs.writeFileSync(LAYOUT_BACKUP, JSON.stringify(backup, null, 2));
  // Kategorierne: STATS (0) og LINK (1) bliver øverst, derefter vores
  const top = ['statskat', 'linkkat'].map(n => config.kanaler[n]).filter(Boolean);
  const mine = [...top, ...kat.map(x => x.k.id)];
  // Nederst: staff og admin (vigtigste øverst, staff nederst)
  const bund = [config.kanaler.aktivkat, guild.channels.cache.get(config.kanaler.staffchat)?.parentId, config.kanaler.stafftalekat, config.kanaler.adminkat].filter(Boolean);
  const resten = alle.filter(c => c.type === ChannelType.GuildCategory && !mine.includes(c.id) && !bund.includes(c.id)).sort((a, b) => a.rawPosition - b.rawPosition).map(c => c.id);
  const raekke = [...new Set([...mine, ...resten, ...bund])];
  await guild.channels.setPositions(raekke.map((id, position) => ({ channel: id, position }))).catch(e => console.error('Layout kategorier:', e.message));
  // Kanalerne ind i kategorierne én ad gangen (uden at røre deres rettigheder)
  let flyttet = 0;
  const raekkefoelge = [];
  for (const { l, k } of kat) {
    let n = 0;
    for (const navn of l.kanaler) {
      const c = config.kanaler[navn] ? guild.channels.cache.get(config.kanaler[navn]) : guild.channels.cache.find(x => x.name === navn && x.type !== ChannelType.GuildCategory);
      if (!c) continue;
      if (GAMLE_NAVNE[c.name]) await c.setName(GAMLE_NAVNE[c.name]).catch(() => {}); // engelsk -> dansk
      if (c.parentId !== k.id) await c.setParent(k.id, { lockPermissions: false }).catch(e => console.error(`Layout: kunne ikke flytte ${c.name}:`, e.message));
      raekkefoelge.push({ channel: c.id, position: n++ });
      flyttet++;
    }
  }
  await guild.channels.setPositions(raekkefoelge).catch(e => console.error('Layout rækkefølge:', e.message));
  // Fjern løse, tomme kategorier (dem vi selv bruger og staff-kategorierne bliver)
  await guild.channels.fetch();
  const beskyttet = new Set([...kat.map(x => x.k.id), ...['statskat', 'linkkat', 'aktivkat', 'adminkat', 'stafftalekat', 'privatkat', 'support'].map(n => config.kanaler[n]),
    guild.channels.cache.get(config.kanaler.staffchat)?.parentId].filter(Boolean));
  for (const c of guild.channels.cache.values()) {
    if (c.type !== ChannelType.GuildCategory || beskyttet.has(c.id)) continue;
    if (!guild.channels.cache.some(x => x.parentId === c.id)) { console.log(`Layout: sletter tom kategori "${c.name}"`); await c.delete('Tom kategori efter layout').catch(() => {}); }
  }
  return { flyttet, kategorier: kat.length, nye: backup.oprettet.length };
}
async function layoutFortryd(guild) {
  if (!fs.existsSync(LAYOUT_BACKUP)) return null;
  const b = JSON.parse(fs.readFileSync(LAYOUT_BACKUP, 'utf8'));
  await guild.channels.fetch();
  for (const c of b.kanaler) { const k = guild.channels.cache.get(c.id); if (k && k.name !== c.navn) await k.setName(c.navn).catch(() => {}); }
  const poster = b.kanaler.filter(c => guild.channels.cache.has(c.id)).map(c => ({ channel: c.id, position: c.pos, parent: c.kat ? undefined : c.parent, lockPermissions: false }));
  await guild.channels.setPositions(poster).catch(e => console.error('Layout fortryd:', e.message));
  for (const id of b.oprettet) { const k = guild.channels.cache.get(id); if (k && !guild.channels.cache.some(c => c.parentId === id)) await k.delete().catch(() => {}); }
  fs.renameSync(LAYOUT_BACKUP, `layout-fortrudt-${Date.now()}.json`);
  return { kanaler: poster.length };
}
// ================= FLERE STAFF-KANALER =================
const STAFF_KANALER = [
  { noegle: 'staffnyheder', navn: '📢┃staff-nyheder', topic: 'Nyt til staff: ændringer, beslutninger og information. Kun Ejer og Admin skriver her.', skriv: ['Ejer', 'Admin'],
    emb: ['📢 Staff-nyheder', 'Her skriver Ejer og Admin, når der er nyt til holdet: ændringer, beslutninger og vigtig information.'] },
  { noegle: 'staffregler', navn: '📜┃staff-regler', topic: 'Reglerne for staff. Kun Ejer og Admin skriver her.', skriv: ['Ejer', 'Admin'],
    emb: ['📜 Regler for staff', ['**1.** Vær venlig og hjælpsom over for alle spillere.', '**2.** Brug aldrig dine rettigheder til egen fordel.', '**3.** Giv straffe efter /straf-grundene, og skriv altid en grund.', '**4.** Del aldrig private oplysninger om spillere eller serveren.', '**5.** Er du i tvivl, så spørg en Admin før du handler.', '**6.** Svar på tilkaldelser i #support-alarmer, så hurtigt du kan.'].join('\n')] },
  { noegle: 'alarmer', navn: '🚨┃support-alarmer', topic: 'Her kommer besked, når en spiller tilkalder staff eller venter i Afventer support.', skriv: [],
    emb: ['🚨 Support-alarmer', 'Når en spiller tilkalder staff, eller venter i **⏳┃Afventer support**, kommer det her. Træk spilleren ned i et support-rum for at hjælpe.'] },
  { noegle: 'staffcmd', navn: '🛠┃staff-kommandoer', topic: 'Brug staff-kommandoerne her (/cc, /screenshare, /ban m.fl.).', skriv: STAFF_NAVNE_ALLE(),
    emb: null },
  { noegle: 'staffforslag', navn: '💡┃staff-forslag', topic: 'Forslag fra staff. Lav et forslag med /staffforslag (i #staff-kommandoer) og stem med reaktioner.', skriv: [], reager: true,
    emb: ['💡 Sådan laver du et staff-forslag', 'Skriv **/staffforslag** (i #staff-kommandoer) for at lave et forslag.\nHer i kanalen stemmer staff med reaktioner. Ejer og Admin svarer med **/godkend** og **/afvis**.'] },
];
function STAFF_NAVNE_ALLE() { return ['Ejer', 'Admin', 'Mod', 'Hjælper']; }
async function opsaetStaffKanaler(guild) {
  await guild.roles.fetch();
  const parent = (await guild.channels.fetch(config.kanaler.staffchat).catch(() => null))?.parentId;
  const rolle = n => guild.roles.cache.find(r => r.name === n);
  for (const sk of STAFF_KANALER) {
    let k = config.kanaler[sk.noegle] && await guild.channels.fetch(config.kanaler[sk.noegle]).catch(() => null);
    const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] }];
    for (const n of STAFF_NAVNE_ALLE()) {
      const r = rolle(n); if (!r) continue;
      const skriver = sk.skriv.includes(n);
      ow.push({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory, ...(skriver || sk.reager ? [P.AddReactions] : []), ...(skriver ? [P.SendMessages] : [])], deny: skriver ? [] : [P.SendMessages] });
    }
    if (!k) {
      k = await guild.channels.create({ name: sk.navn, type: ChannelType.GuildText, parent: parent || undefined, topic: sk.topic, permissionOverwrites: ow }).catch(e => { console.error(`${sk.navn}:`, e.message); return null; });
      if (!k) continue;
      config.kanaler[sk.noegle] = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
      console.log(`${sk.navn} er oprettet.`);
    } else await k.permissionOverwrites.set(ow).catch(() => {});
    if (sk.emb) await opdaterPanel(k, sk.emb[0], { embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(sk.emb[0]).setDescription(sk.emb[1])] });
  }
}
// ================= ADMIN-KATEGORI (kun Ejer og Admin) =================
const ADMIN_KAT = '[ 🛡️ ] ADMIN';
async function opsaetAdmin(guild) {
  await guild.channels.fetch(); await guild.roles.fetch();
  const roller = ['Ejer', 'Admin'].map(n => guild.roles.cache.find(r => r.name === n)).filter(Boolean);
  const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageChannels] },
    ...roller.map(r => ({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory] }))];
  let kat = config.kanaler.adminkat && guild.channels.cache.get(config.kanaler.adminkat)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === ADMIN_KAT);
  if (!kat) kat = await guild.channels.create({ name: ADMIN_KAT, type: ChannelType.GuildCategory, permissionOverwrites: ow }).catch(e => { console.error('Admin-kategori:', e.message); return null; });
  if (!kat) return;
  config.kanaler.adminkat = kat.id;
  // Kanal til ansøgninger fra hjemmesiden
  let ak = config.kanaler.ansogsvar && guild.channels.cache.get(config.kanaler.ansogsvar);
  const akOw = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] },
    ...roller.map(r => ({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AddReactions] }))];
  if (!ak) ak = await guild.channels.create({ name: '📝┃ansøgninger-afventer', type: ChannelType.GuildText, parent: kat.id, topic: 'Nye ansøgninger fra hjemmesiden, der venter på svar. Kun Ejer og Admin.', permissionOverwrites: akOw }).catch(e => { console.error('Ansøgninger-kanal:', e.message); return null; });
  else await ak.permissionOverwrites.set(akOw).catch(() => {});
  if (ak) config.kanaler.ansogsvar = ak.id;
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  // Ticket-log: kun Ejer/Admin (og botten)
  const tl = config.kanaler.ticketlog && guild.channels.cache.get(config.kanaler.ticketlog);
  if (tl) await tl.permissionOverwrites.set([{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] },
    ...roller.map(r => ({ id: r.id, allow: [P.ViewChannel, P.ReadMessageHistory] }))]).catch(() => {});
  // Flyt kanalerne ind (deres egne rettigheder bevares)
  for (const noegle of ['ansogsvar', 'livechat', 'botlog', 'ticketlog']) {
    const c = config.kanaler[noegle] && guild.channels.cache.get(config.kanaler[noegle]);
    if (c && c.parentId !== kat.id) await c.setParent(kat.id, { lockPermissions: false }).catch(e => console.error(`Flyt ${noegle}:`, e.message));
  }
}
// ================= STAFF-TALEKANALER =================
const STAFF_TALE = [
  { noegle: 'staffvoice', navn: '🔒┃Staff-tale 1', gamle: ['🔒 Staff voice'], roller: ['Ejer', 'Admin', 'Mod', 'Hjælper'] },
  { noegle: 'stafftale2', navn: '🔒┃Staff-tale 2', gamle: [], roller: ['Ejer', 'Admin', 'Mod', 'Hjælper'] },
  { noegle: 'admintale', navn: '🛡️┃Admin-tale', gamle: [], roller: ['Ejer', 'Admin'] },
];
const STAFF_TALE_KAT = '[ 🔒 ] STAFF TALE';
async function opsaetStaffTale(guild) {
  await guild.channels.fetch(); await guild.roles.fetch();
  const rolle = n => guild.roles.cache.find(r => r.name === n);
  const alle = ['Ejer', 'Admin', 'Mod', 'Hjælper'].map(rolle).filter(Boolean);
  let kat = config.kanaler.stafftalekat && guild.channels.cache.get(config.kanaler.stafftalekat)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === STAFF_TALE_KAT);
  if (!kat) kat = await guild.channels.create({ name: STAFF_TALE_KAT, type: ChannelType.GuildCategory, permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] }, ...alle.map(r => ({ id: r.id, allow: [P.ViewChannel, P.Connect, P.Speak] }))] }).catch(e => { console.error('Staff-tale:', e.message); return null; });
  if (!kat) return;
  config.kanaler.stafftalekat = kat.id;
  for (const st of STAFF_TALE) {
    const roller = st.roller.map(rolle).filter(Boolean);
    const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel, P.Connect] }, ...roller.map(r => ({ id: r.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.UseVAD, P.MoveMembers, P.Stream] }))];
    let k = config.kanaler[st.noegle] && guild.channels.cache.get(config.kanaler[st.noegle])
      || guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && [st.navn, ...st.gamle].includes(c.name));
    if (!k) k = await guild.channels.create({ name: st.navn, type: ChannelType.GuildVoice, parent: kat.id, permissionOverwrites: ow }).catch(e => { console.error(st.navn, e.message); return null; });
    if (!k) continue;
    config.kanaler[st.noegle] = k.id;
    if (k.name !== st.navn) await k.setName(st.navn).catch(() => {});
    await k.permissionOverwrites.set(ow).catch(() => {});
    if (k.parentId !== kat.id) await k.setParent(kat.id, { lockPermissions: false }).catch(() => {});
  }
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}

// ================= PRIVATE RUM (spillere laver egne talekanaler med adgangs-system) =================
const PRIVAT_FIL = 'privat.json';
let privat = (() => { try { return JSON.parse(fs.readFileSync(PRIVAT_FIL, 'utf8')); } catch { return {}; } })(); // voiceId -> { ejer, panel, navn }
const gemPrivat = () => fs.writeFileSync(PRIVAT_FIL, JSON.stringify(privat));
const privatTomTimer = new Map();
const privatAnmod = new Map(); // "rum:bruger" -> tid
async function opsaetPrivat(guild) {
  await guild.channels.fetch(); await guild.roles.fetch();
  const spiller = guild.roles.cache.get(config.roller['Spiller']);
  let kat = config.kanaler.privatkat && guild.channels.cache.get(config.kanaler.privatkat)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === PRIVAT_KAT);
  if (!kat) kat = await guild.channels.create({ name: PRIVAT_KAT, type: ChannelType.GuildCategory, permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] }, ...(spiller ? [{ id: spiller.id, allow: [P.ViewChannel] }] : [])] }).catch(e => { console.error('Private rum:', e.message); return null; });
  if (!kat) return;
  config.kanaler.privatkat = kat.id;
  let k = config.kanaler.privatkanal && guild.channels.cache.get(config.kanaler.privatkanal);
  const ow = [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageMessages] },
    ...(spiller ? [{ id: spiller.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads, P.CreatePrivateThreads] }] : []),
    ...STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }))];
  if (!k) k = await guild.channels.create({ name: PRIVAT_KANAL, type: ChannelType.GuildText, parent: kat.id, topic: 'Lav dit eget private talerum. Andre skal bede om adgang.', permissionOverwrites: ow }).catch(e => { console.error('Private rum:', e.message); return null; });
  else await k.permissionOverwrites.set(ow).catch(() => {});
  if (!k) return;
  config.kanaler.privatkanal = k.id; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  const opret = await opdaterPanel(k, '🔐 Private rum', {
    embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🔐 Private rum')
      .setDescription('Lav dit eget talerum, hvor kun dem du giver adgang kan joine.\n\n**1.** Tryk på **Opret privat rum**, og vælg et navn og hvor mange pladser (2-25).\n**2.** Andre kan se rummet, men skal trykke **Bed om adgang** på dit rum herunder.\n**3.** Du får en besked, hvor du kan sige ja eller nej.\n\nRummet bliver fuldt, når pladserne er brugt, og det slettes af sig selv, når der ikke har været nogen i det i 5 minutter.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('privat_opret').setLabel('Opret privat rum').setEmoji('➕').setStyle(ButtonStyle.Success))],
  });
  if (opret?.pin && !opret.pinned) opret.pin().catch(() => {});
  // Fjern løse beskeder (gamle anmodninger og svar) - kun panelerne bliver stående
  const gyldige = new Set(Object.entries(privat).filter(([id]) => guild.channels.cache.has(id)).map(([, x]) => x.panel));
  const msgs = await k.messages.fetch({ limit: 100 }).catch(() => null);
  if (msgs) for (const m of msgs.values()) if (m.author.id === client.user.id && m.embeds[0]?.title !== '🔐 Private rum' && !gyldige.has(m.id)) await m.delete().catch(() => {});
  // Ryd op i rum, der ikke findes mere, og planlæg sletning af tomme
  for (const id of Object.keys(privat)) {
    const v = guild.channels.cache.get(id);
    if (!v) { delete privat[id]; continue; }
    planlaegTomtRum(guild, id, 5 * 60000);
    opdaterPrivatPanel(guild, id);
  }
  gemPrivat();
}
function privatEmbed(v, navn, ejer) {
  const nu = v.members?.size || 0;
  return new EmbedBuilder().setColor(nu >= v.userLimit && v.userLimit ? 0xef4444 : 0x57f287).setTitle(`🔐 ${navn}`)
    .setDescription(`Ejer: <@${ejer}>\nRum: ${v}\nPladser: **${nu}/${v.userLimit || '∞'}**${v.userLimit && nu >= v.userLimit ? ' · 🔴 fuldt' : ''}`);
}
const privatKnapper = id => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`privat_bed:${id}`).setLabel('Bed om adgang').setEmoji('🙋').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId(`privat_admin:${id}`).setLabel('Administrer').setEmoji('⚙️').setStyle(ButtonStyle.Secondary))];
// Kun rummets ejer samt Ejer/Admin må ændre eller slette et privat rum (fx hvis navnet er skadende)
const erAdminM = m => erEjer(m) || m.permissions.has(P.Administrator) || m.roles.cache.some(r => r.name === 'Admin');
async function opdaterPrivatPanel(guild, id) {
  const d = privat[id]; if (!d) return;
  const v = guild.channels.cache.get(id); const k = guild.channels.cache.get(config.kanaler.privatkanal);
  if (!v || !k) return;
  const m = await k.messages.fetch(d.panel).catch(() => null);
  if (m) m.edit({ embeds: [privatEmbed(v, d.navn, d.ejer)], components: privatKnapper(id) }).catch(() => {});
}
async function sletPrivat(guild, id) {
  const d = privat[id]; clearTimeout(privatTomTimer.get(id)); privatTomTimer.delete(id);
  const v = guild.channels.cache.get(id); if (v) await v.delete().catch(() => {});
  const k = guild.channels.cache.get(config.kanaler.privatkanal);
  if (d && k) { const m = await k.messages.fetch(d.panel).catch(() => null); if (m) m.delete().catch(() => {}); }
  delete privat[id]; gemPrivat();
}
function planlaegTomtRum(guild, id, ms) {
  clearTimeout(privatTomTimer.get(id));
  privatTomTimer.set(id, setTimeout(async () => {
    const v = await guild.channels.fetch(id).catch(() => null);
    if (!privat[id]) return;
    if (!v) { delete privat[id]; gemPrivat(); return; }
    if (v.members.size === 0) sletPrivat(guild, id); else opdaterPrivatPanel(guild, id);
  }, ms));
}
client.on('voiceStateUpdate', (gl, ny) => {
  for (const id of new Set([gl.channelId, ny.channelId].filter(x => x && privat[x]))) {
    opdaterPrivatPanel(ny.guild, id);
    const v = ny.guild.channels.cache.get(id);
    if (v && v.members.size === 0) planlaegTomtRum(ny.guild, id, 5 * 60000); else clearTimeout(privatTomTimer.get(id));
  }
});
async function privatKnap(i) {
  const [handling, id, bruger] = i.customId.split(':');
  const d = privat[id];
  if (handling !== 'privat_opret' && !d) return i.reply({ content: 'Det rum findes ikke mere.', flags: MessageFlags.Ephemeral });
  const maaStyre = d && (i.user.id === d.ejer || erAdminM(i.member));
  if (handling === 'privat_opret') {
    const har = Object.entries(privat).find(([, x]) => x.ejer === i.user.id);
    if (har) return i.reply({ content: `Du har allerede et privat rum: <#${har[0]}>. Slet det først.`, flags: MessageFlags.Ephemeral });
    return i.showModal(new ModalBuilder().setCustomId('privat_modal').setTitle('Opret privat rum').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('navn').setLabel('Navn på rummet (valgfrit)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(25)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('antal').setLabel('Hvor mange pladser? (2-25)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue('4'))));
  }
  if (handling === 'privat_bed') {
    if (i.user.id === d.ejer) return i.reply({ content: 'Det er dit eget rum 🙂', flags: MessageFlags.Ephemeral });
    const v = i.guild.channels.cache.get(id);
    if (v?.permissionOverwrites.cache.get(i.user.id)?.allow.has(P.Connect)) return i.reply({ content: `Du har allerede adgang: ${v}`, flags: MessageFlags.Ephemeral });
    const sidst = privatAnmod.get(`${id}:${i.user.id}`) || 0;
    if (Date.now() - sidst < 60000) return i.reply({ content: '⏳ Du har lige bedt om adgang. Vent lidt.', flags: MessageFlags.Ephemeral });
    privatAnmod.set(`${id}:${i.user.id}`, Date.now());
    await i.channel.send({ content: `<@${d.ejer}>`, allowedMentions: { users: [d.ejer] },
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🙋 Anmodning om adgang').setDescription(`${i.user} vil gerne ind i ${v || d.navn}.\nKun ejeren (<@${d.ejer}>) kan svare.`)],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`privat_ok:${id}:${i.user.id}`).setLabel('Giv adgang').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`privat_nej:${id}:${i.user.id}`).setLabel('Afvis').setEmoji('❌').setStyle(ButtonStyle.Danger))] })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 15 * 60000)); // ubesvarede anmodninger fjernes efter 15 min
    return i.reply({ content: '✅ Anmodningen er sendt til ejeren. Du kan joine, når du får adgang.', flags: MessageFlags.Ephemeral });
  }
  if (!maaStyre) return i.reply({ content: 'Kun ejeren af rummet kan gøre det.', flags: MessageFlags.Ephemeral });
  if (handling === 'privat_admin') {
    return i.reply({ flags: MessageFlags.Ephemeral, content: `⚙️ Administrer **${d.navn}**${i.user.id !== d.ejer ? ' (som admin)' : ''}`, components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`privat_antal:${id}`).setLabel('Skift antal').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`privat_luk:${id}`).setLabel('Slet rum').setEmoji('🗑️').setStyle(ButtonStyle.Danger))] });
  }
  if (handling === 'privat_ok' || handling === 'privat_nej') {
    const v = i.guild.channels.cache.get(id);
    if (handling === 'privat_ok' && v) await v.permissionOverwrites.edit(bruger, { ViewChannel: true, Connect: true, Speak: true }).catch(() => {});
    const besked = i.message;
    await i.update({ content: '', components: [], embeds: [new EmbedBuilder().setColor(handling === 'privat_ok' ? 0x57f287 : 0xef4444)
      .setDescription(handling === 'privat_ok' ? `✅ <@${bruger}> har fået adgang til ${v || d.navn}.` : `❌ <@${bruger}> blev afvist.`)] });
    return setTimeout(() => besked.delete().catch(() => {}), 20000); // svaret fjernes igen, så kanalen ikke bliver proppet
  }
  if (handling === 'privat_antal') {
    const v = i.guild.channels.cache.get(id);
    return i.showModal(new ModalBuilder().setCustomId(`privat_antal_modal:${id}`).setTitle('Skift antal pladser').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('antal').setLabel('Hvor mange pladser? (2-25)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(String(v?.userLimit || 4)))));
  }
  if (handling === 'privat_luk') {
    await i.reply({ content: '🗑️ Rummet er slettet.', flags: MessageFlags.Ephemeral });
    return sletPrivat(i.guild, id);
  }
}
async function privatModal(i) {
  const antal = Math.min(25, Math.max(2, parseInt(i.fields.getTextInputValue('antal'), 10) || 4));
  if (i.customId.startsWith('privat_antal_modal')) {
    const id = i.customId.split(':')[1]; const d = privat[id];
    if (!d || (i.user.id !== d.ejer && !erAdminM(i.member))) return i.reply({ content: 'Kun ejeren kan ændre antal.', flags: MessageFlags.Ephemeral });
    await i.guild.channels.cache.get(id)?.setUserLimit(antal).catch(() => {});
    await i.reply({ content: `👥 Rummet har nu **${antal}** pladser.`, flags: MessageFlags.Ephemeral });
    return opdaterPrivatPanel(i.guild, id);
  }
  if (Object.values(privat).some(x => x.ejer === i.user.id)) return i.reply({ content: 'Du har allerede et privat rum.', flags: MessageFlags.Ephemeral });
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const navn = (i.fields.getTextInputValue('navn') || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '') || `${i.member.displayName}s rum`.slice(0, 25);
  const spiller = i.guild.roles.cache.get(config.roller['Spiller']);
  const v = await i.guild.channels.create({ name: `🔒┃${navn}`.slice(0, 90), type: ChannelType.GuildVoice, parent: config.kanaler.privatkat, userLimit: antal, permissionOverwrites: [
    { id: i.guild.roles.everyone.id, deny: [P.ViewChannel, P.Connect] },
    ...(spiller ? [{ id: spiller.id, allow: [P.ViewChannel], deny: [P.Connect] }] : []),
    { id: i.user.id, allow: [P.ViewChannel, P.Connect, P.Speak, P.UseVAD] },
    ...STAFF.filter(Boolean).map(id => ({ id, allow: [P.ViewChannel, P.Connect, P.Speak, P.MoveMembers] })),
    { id: client.user.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] }] }).catch(e => { console.error('Privat rum:', e.message); return null; });
  if (!v) return i.editReply('❌ Kunne ikke oprette rummet.');
  const k = i.guild.channels.cache.get(config.kanaler.privatkanal);
  const m = await k.send({ embeds: [privatEmbed(v, navn, i.user.id)], components: privatKnapper(v.id) });
  privat[v.id] = { ejer: i.user.id, panel: m.id, navn }; gemPrivat();
  planlaegTomtRum(i.guild, v.id, 5 * 60000);
  if (i.member.voice?.channel) await i.member.voice.setChannel(v).catch(() => {});
  return i.editReply(`✅ Dit rum er klar: ${v} (${antal} pladser). Join det, og giv andre adgang, når de beder om det i <#${config.kanaler.privatkanal}>.`);
}
// ================= ENGANGS-OPRYDNING =================
async function engangsOprydning(guild) {
  if (config.oprydning2 || !config.kanaler.ansogsvar) return;
  try {
    // Flyt ansøgninger fra #staff-chat til #ansøgninger-afventer og slet dem i #staff-chat
    const staff = await guild.channels.fetch(config.kanaler.staffchat).catch(() => null);
    const mål = await guild.channels.fetch(config.kanaler.ansogsvar).catch(() => null);
    if (staff && mål) {
      const msgs = [...(await staff.messages.fetch({ limit: 100 })).values()].filter(m => m.author.id === client.user.id && m.embeds[0]?.author?.name?.includes('Ny ansøgning')).reverse();
      for (const m of msgs) {
        const ok = await mål.send({ embeds: m.embeds.map(e => e.toJSON()) }).then(() => true).catch(() => false);
        if (ok) await m.delete().catch(() => {});
      }
      console.log(`${msgs.length} ansøgning(er) er flyttet til #ansøgninger-afventer.`);
    }
    // Fjern #mod-noter og #vagtplan
    for (const noegle of ['modnoter', 'vagtplan']) {
      const k = config.kanaler[noegle] && await guild.channels.fetch(config.kanaler[noegle]).catch(() => null);
      if (k) { await k.delete('Fjernet efter ønske fra Ejer').catch(e => console.error(`Slet ${noegle}:`, e.message)); console.log(`#${noegle} er slettet.`); }
      delete config.kanaler[noegle];
    }
    config.oprydning2 = true; fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  } catch (e) { console.error('Oprydning:', e.message); }
}
// ================= ROLLER MED SKILLELINJER (roller.json) =================
// Botten opretter rollerne, sætter dem i rækkefølge med skillelinjer imellem, giver skillelinjerne
// til alle der har en rolle i gruppen, og giver roller ud fra "tildel" (Discord-brugernavn -> roller).
const ROLLER_FIL = 'roller.json';
let rollerTid = 0, rollerData = null;
const skilleNavn = t => `────── ${t} ──────`;
const rolleNavn = r => (typeof r === 'string' ? r : r.navn);
async function synkRollerFil(tving = false) {
  try {
    const mt = fs.statSync(ROLLER_FIL).mtimeMs;
    if (!tving && mt === rollerTid) return;
    rollerTid = mt;
    rollerData = JSON.parse(fs.readFileSync(ROLLER_FIL, 'utf8'));
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    const findEllerLav = async (navn, opts) => guild.roles.cache.find(r => r.name === navn)
      || await guild.roles.create({ name: navn, permissions: [], mentionable: false, ...opts, reason: 'HOPDOP roller.json' }).then(r => { devlogDiscord(`🏷️ Ny rolle: <@&${r.id}>`); return r; });
    // 1) Opret roller og skillelinjer, og saml rækkefølgen
    const raekke = [];
    for (const g of rollerData.grupper) {
      const skille = await findEllerLav(skilleNavn(g.skille), { color: 0, hoist: false });
      // Skillelinjen må ikke have farve, ellers overskriver den farven fra Ejer/Admin osv. i medlemslisten
      if (skille.color !== 0) await skille.setColor(0, 'Skillelinje uden farve').catch(e => console.error('Skillelinje-farve:', e.message));
      raekke.push(skille);
      for (const r of g.roller) raekke.push(await findEllerLav(rolleNavn(r), { mentionable: false }));
    }
    // 2) Sæt rækkefølgen lige under botten
    const top = guild.members.me.roles.highest.position;
    const pos = raekke.filter(r => r.position < top).map((r, idx, arr) => ({ role: r.id, position: top - 1 - idx }));
    await guild.roles.setPositions(pos).catch(e => console.error('Rækkefølge af roller:', e.message));
    // "Bots" ligger altid nederst, under alle andre roller
    const botsR = guild.roles.cache.find(r => r.name === 'Bots' && !r.managed);
    if (botsR) await botsR.setPosition(1).catch(e => console.error('Bots-position:', e.message));
    // 3) Giv roller fra "tildel"
    const medlemmer = await guild.members.fetch();
    for (const [navn, roller] of Object.entries(rollerData.tildel || {})) {
      if (navn.startsWith('_')) continue;
      const m = medlemmer.find(x => x.user.username.toLowerCase() === navn.toLowerCase() || x.displayName.toLowerCase() === navn.toLowerCase());
      if (!m) { console.log(`roller.json: fandt ikke "${navn}" på Discorden`); continue; }
      for (const rn of roller) { const r = guild.roles.cache.find(x => x.name === rn); if (r && !m.roles.cache.has(r.id)) await m.roles.add(r, 'roller.json').catch(e => console.error('Rolle:', e.message)); }
    }
    await synkSkillelinjer(guild, medlemmer);
    await opdaterRolleVaelger(guild);
    console.log('Roller er synket fra roller.json.');
  } catch (e) { console.error('roller.json:', e.message); }
}
// Skillelinjen i en gruppe gives til alle, der har mindst én rolle i gruppen
async function synkSkillelinjer(guild, medlemmer) {
  if (!rollerData) return;
  medlemmer = medlemmer || await guild.members.fetch();
  for (const g of rollerData.grupper) {
    const skille = guild.roles.cache.find(r => r.name === skilleNavn(g.skille));
    if (!skille) continue;
    const ids = g.roller.map(r => guild.roles.cache.find(x => x.name === rolleNavn(r))?.id).filter(Boolean);
    for (const m of medlemmer.values()) {
      if (m.user.bot) continue;
      const skal = m.roles.cache.some(r => ids.includes(r.id));
      if (skal && !m.roles.cache.has(skille.id)) await m.roles.add(skille).catch(() => {});
      if (!skal && m.roles.cache.has(skille.id)) await m.roles.remove(skille).catch(() => {});
    }
  }
}
client.on('guildMemberUpdate', (gl, ny) => {
  if (!rollerData || gl.roles.cache.size === ny.roles.cache.size && gl.roles.cache.every(r => ny.roles.cache.has(r.id))) return;
  for (const g of rollerData.grupper) {
    const skille = ny.guild.roles.cache.find(r => r.name === skilleNavn(g.skille));
    if (!skille) continue;
    const ids = g.roller.map(r => ny.guild.roles.cache.find(x => x.name === rolleNavn(r))?.id).filter(Boolean);
    const skal = ny.roles.cache.some(r => ids.includes(r.id));
    if (skal && !ny.roles.cache.has(skille.id)) ny.roles.add(skille).catch(() => {});
    if (!skal && ny.roles.cache.has(skille.id)) ny.roles.remove(skille).catch(() => {});
  }
});

// #roller: spillerne vælger selv notifikationsroller ved at reagere med en emoji
let rolleBeskedId = null;
const rensEmoji = e => String(e || '').replace(/️/g, '');
async function opdaterRolleVaelger(guild) {
  const g = (rollerData?.grupper || []).find(x => x.vaelg);
  if (!g) return;
  const kanal = await sikrKanal(guild, 'roller', '🔔┃roller', 'Vælg selv hvad du vil have ping om', config.kanaler.velkommen);
  const emb = new EmbedBuilder().setColor(LILLA).setAuthor({ name: 'HOPDOP · Roller' })
    .setTitle('🔔 Vælg dine notifikationer')
    .setDescription(['Reager med en emoji for at få rollen. Fjern din reaktion for at fjerne den igen.', '',
      ...g.roller.map(r => `${r.emoji || '🔔'}  **${r.navn}** · ${r.info || ''}`)].join('\n'))
    .setFooter({ text: 'Du får kun ping om det, du har valgt' });
  let besked = await bottensBesked(kanal);
  if (besked) besked = await besked.edit({ embeds: [emb], components: [] }); else besked = await kanal.send({ embeds: [emb] });
  rolleBeskedId = besked.id;
  for (const r of g.roller) if (!besked.reactions.cache.some(x => rensEmoji(x.emoji.name) === rensEmoji(r.emoji) && x.me)) await besked.react(r.emoji || '🔔').catch(e => console.error('Reaktion:', e.message));
}
async function rolleReaktion(reaktion, bruger, tilfoej) {
  if (bruger.bot) return;
  if (reaktion.partial) reaktion = await reaktion.fetch().catch(() => null);
  if (!reaktion || reaktion.message.id !== rolleBeskedId) return;
  const g = (rollerData?.grupper || []).find(x => x.vaelg);
  const valg = g?.roller.find(r => rensEmoji(r.emoji) === rensEmoji(reaktion.emoji.name));
  if (!valg) { if (tilfoej) reaktion.users.remove(bruger.id).catch(() => {}); return; }
  const guild = reaktion.message.guild;
  const rolle = guild.roles.cache.find(x => x.name === valg.navn);
  const m = await guild.members.fetch(bruger.id).catch(() => null);
  if (!rolle || !m) return;
  if (tilfoej) await m.roles.add(rolle, '#roller').catch(e => console.error('Rolle:', e.message));
  else await m.roles.remove(rolle, '#roller').catch(e => console.error('Rolle:', e.message));
}
client.on('messageReactionAdd', (r, u) => rolleReaktion(r, u, true));
client.on('messageReactionRemove', (r, u) => rolleReaktion(r, u, false));
// Ping-rolle til automatiske opslag (fx "Giveaway"), hvis den findes
// Notifikationsroller kan ikke pinges af spillere: botten åbner for pinget lige mens beskeden sendes
async function sendPing(kanal, navn, payload) {
  const r = kanal.guild.roles.cache.find(x => x.name === navn);
  if (r) await r.setMentionable(true).catch(() => {});
  try { return await kanal.send({ ...payload, content: r ? `<@&${r.id}>` : undefined }); }
  finally { if (r) r.setMentionable(false).catch(() => {}); }
}
const ping = (guild, navn) => { const r = guild?.roles.cache.find(x => x.name === navn); return r ? `<@&${r.id}>` : ''; };

// ---------- TICKET-UDSKRIFT: hele samtalen som .txt-fil ----------
async function lavUdskrift(kanal, lukketAf) {
  let alle = [], foer;
  for (let n = 0; n < 20; n++) { // op til 2000 beskeder
    const bunke = await kanal.messages.fetch({ limit: 100, before: foer });
    if (!bunke.size) break;
    alle.push(...bunke.values()); foer = bunke.last().id;
    if (bunke.size < 100) break;
  }
  alle = alle.reverse();
  const ejerId = (kanal.topic || '').replace('ticket:', '');
  const ejer = await client.users.fetch(ejerId).catch(() => null);
  const typeNavn = Object.values(TYPER).find(([, e]) => kanal.name.startsWith(e))?.[0] || 'Ticket';
  const beskeder = alle.map(m => ({
    f: m.author.displayAvatarURL({ size: 64, extension: 'png' }), a: m.member?.displayName || m.author.username, bot: m.author.bot, t: m.createdTimestamp,
    x: m.cleanContent || '',
    e: m.embeds.map(e => ({ t: e.title || '', x: e.description || '' })),
    v: [...m.attachments.values()].map(x => ({ n: x.name, u: x.url })),
  }));
  const nr = String(Math.floor(Date.now() / 1000) % 100000000).padStart(8, '0');
  const udskrift = { ticket: nr, type: typeNavn, aabnetAf: ejer?.username || 'ukendt', lukketAf: lukketAf?.username || 'ukendt', aabnet: kanal.createdTimestamp, lukket: Date.now(), beskeder };
  const { id } = await postPrivat('samtale', udskrift);
  return { antal: alle.length, link: `${WEB}/samtale.html?id=${id}`, nr };
}

// ---------- /top: leaderboards som på hjemmesiden ----------
const TOP = {
  samlet: { navn: 'Samlet placering', info: 'Gennemsnit af plads på kills, K/D og daily-streak (som ingame).' },
  kills:  { navn: 'Kills',        v: s => s.k,  f: v => `${tal(v)} kills` },
  kd:     { navn: 'K/D',          v: s => s.k >= 10 ? s.k / Math.max(1, s.d) : 0, f: v => `${tal(v, 2)} K/D`, info: 'Kræver mindst 10 kills.' },
  daily:  { navn: 'Daily-streak', v: s => s.ds, f: v => `${tal(v)} dage` },
  rating: { navn: 'Duel-rating',  duel: true, v: s => s.elo, f: v => `${tal(v)} rating` },
  dsejre: { navn: 'Duel-sejre',   duel: true, v: s => s.s,   f: v => `${tal(v)} ${v === 1 ? 'sejr' : 'sejre'}` },
  duge:   { navn: 'Ugens duel-sejre', duel: true, v: s => s.us, f: v => `${tal(v)} ${v === 1 ? 'sejr' : 'sejre'}` },
  koth:   { navn: 'KOTH-sejre (teams)', team: true, v: t => t.koth, f: v => `${tal(v)} KOTH` },
  tkills: { navn: 'Team-kills',   team: true, v: t => t.k,   f: v => `${tal(v)} kills` },
};
const MEDALJE = ['🥇', '🥈', '🥉'];

async function lavTopEmbed(id, kompakt = false) {
  const t = TOP[id];
  const stats = await hentWeb('stats');
  let raekker;
  if (id === 'samlet') {
    const alle = stats.spillere;
    const r = {};
    for (const k of ['kills', 'kd', 'daily']) for (const x of alle) r[x.u] = (r[x.u] || 0) + rank(alle, x, VAL[k]);
    raekker = alle.map(x => ({ n: x.n, sc: r[x.u] / 3 })).sort((a, b) => a.sc - b.sc).slice(0, 10)
      .map(x => ({ n: x.n, tekst: `gns. plads ${tal(x.sc, 1)}` }));
  } else {
    const liste = t.duel ? (await hentWeb('duel')).spillere || [] : t.team ? stats.teams || [] : stats.spillere;
    raekker = liste.filter(x => t.v(x) > 0).sort((a, b) => t.v(b) - t.v(a)).slice(0, 10)
      .map(x => ({ n: x.n, tekst: t.f(t.v(x)) }));
  }
  const linjer = raekker.map((x, i) => `${MEDALJE[i] || `\`${String(i + 1).padStart(2)}.\``} **${x.n}** · ${x.tekst}`);
  return new EmbedBuilder().setColor(LILLA)
    .setAuthor({ name: 'HOPDOP · Leaderboards' })
    .setTitle(`🏆 Top 10 · ${t.navn}`)
    .setURL(`${WEB}/leaderboards.html`)
    .setDescription((linjer.join('\n') || 'Ingen på listen endnu.') + (t.info ? `\n\n*${t.info}*` : ''))
    .setFooter(kompakt ? null : { text: 'Brug /stats <navn> for at se en spiller · Klik på titlen for alle leaderboards' })
    .setAuthor(kompakt ? null : { name: 'HOPDOP · Leaderboards' });
}

// ---------- /online og botstatus ----------
async function lavOnlineEmbed() {
  const stats = await hentWeb('stats');
  const online = [...(stats.online || [])].sort((a, b) => a.localeCompare(b));
  const teamAf = n => { const sp = stats.spillere.find(x => x.n.toLowerCase() === n.toLowerCase());
    const t = sp && (stats.teams || []).find(t => t.m.some(m => m.u === sp.u)); return t ? ` · *${t.n}*` : ''; };
  const minSiden = stats.opdateret ? Math.max(0, Math.round((Date.now() - stats.opdateret) / 60000)) : null;
  return new EmbedBuilder().setColor(online.length ? 0x22c55e : 0x64748b)
    .setAuthor({ name: 'HOPDOP · Online' })
    .setTitle(`🟢 ${online.length} ${online.length === 1 ? 'spiller' : 'spillere'} online`)
    .setDescription(online.length ? online.map(n => `• **${n}**${teamAf(n)}`).join('\n').slice(0, 4000) : 'Der er ingen online lige nu. Vær den første!')
    .addFields({ name: '🌐 Join', value: `\`${SERVER_IP}\`` })
    .setFooter({ text: `Listen opdateres hvert 5. min.${minSiden === null ? '' : ` · Sidst for ${minSiden} min. siden`}` });
}

async function onlineTekst() {
  try {
    const on = (await hentWeb('stats')).online || [];
    if (!on.length) return 'Ingen online lige nu. Vær den første!';
    const navne = on.slice(0, 15).map(n => `\`${n}\``).join(' ');
    return `**${on.length}** ${on.length === 1 ? 'spiller' : 'spillere'}: ${navne}${on.length > 15 ? ` +${on.length - 15}` : ''}`;
  } catch { return 'Kunne ikke hente lige nu.'; }
}

async function opdaterStatus() {
  try {
    const stats = await hentWeb('stats');
    const on = stats.online || [];
    client.user.setPresence({ activities: [{ name: `Hopdop · ${on.length} online`, type: ActivityType.Playing }], status: 'online' });
    const noegle = on.join(',');
    if (ipBesked && noegle !== sidstOnline) {
      sidstOnline = noegle;
      const emb = EmbedBuilder.from(ipBesked.embeds[0]);
      emb.spliceFields(0, 25, { name: '🟢 Online lige nu', value: await onlineTekst() });
      ipBesked = await ipBesked.edit({ embeds: [emb] }).catch(() => ipBesked);
    }
  } catch { /* prøv igen næste gang */ }
}

// ---------- UGENTLIG TOP: søndag kl. 20 i #events ----------
// uge.json husker tallene fra ugens start, så vi kan regne ugens kills og daily ud.
const UGE_FIL = 'uge.json';
const ugeKey = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
async function tjekUgeTop() {
  try {
    const nu = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
    let uge = {}; try { uge = JSON.parse(fs.readFileSync(UGE_FIL, 'utf8')); } catch { /* ny fil */ }
    const stats = await hentWeb('stats');
    if (!uge.start) { // første gang: gem udgangspunkt
      uge = { start: ugeKey(nu), kills: Object.fromEntries(stats.spillere.map(x => [x.u, x.k])), postet: '' };
      fs.writeFileSync(UGE_FIL, JSON.stringify(uge)); return;
    }
    const iDag = nu.toISOString().slice(0, 10);
    if (nu.getDay() !== 0 || nu.getHours() < 20 || uge.postet === iDag) return;
    const kanal = await client.channels.fetch(config.kanaler.events).catch(() => null);
    if (!kanal) return;
    const top3 = (liste, fn, f) => liste.map(x => ({ n: x.n, v: fn(x) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3)
      .map((x, i) => `${MEDALJE[i]} **${x.n}** · ${f(x.v)}`).join('\n') || 'Ingen denne uge';
    const duel = await hentWeb('duel').catch(() => ({ spillere: [] }));
    const emb = new EmbedBuilder().setColor(LILLA).setAuthor({ name: 'HOPDOP · Ugens bedste' })
      .setTitle('🏆 Ugens top 3')
      .setDescription('Godt spillet i denne uge! Her er ugens skarpeste spillere:')
      .addFields(
        { name: '⚔️ Flest kills denne uge', inline: true, value: top3(stats.spillere, x => x.k - (uge.kills[x.u] ?? x.k), v => `${tal(v)} kills`) },
        { name: '🥊 Flest duel-sejre', inline: true, value: top3(duel.spillere || [], x => x.us, v => `${tal(v)} ${v === 1 ? 'sejr' : 'sejre'}`) },
        { name: '📅 Længste daily-streak', inline: true, value: top3(stats.spillere, x => x.ds, v => `${tal(v)} dage`) })
      .setFooter({ text: 'Ny uge starter nu · Se alle lister med /top' });
    await sendPing(kanal, 'Events', { embeds: [emb] });
    fs.writeFileSync(UGE_FIL, JSON.stringify({ start: ugeKey(new Date(nu.getTime() + 86400000)), kills: Object.fromEntries(stats.spillere.map(x => [x.u, x.k])), postet: iDag }));
    console.log('Ugens top er postet i #events.');
  } catch (e) { console.error('Ugens top fejlede:', e.message); }
}

// ---------- #bot-guide: alle kommandoer forklaret (laves af botten selv) ----------
async function opdaterGuide(guild) {
  let kanal = config.kanaler.botguide && await guild.channels.fetch(config.kanaler.botguide).catch(() => null);
  if (!kanal) {
    const info = (await guild.channels.fetch(config.kanaler.velkommen).catch(() => null))?.parentId;
    kanal = await guild.channels.create({
      name: '📖┃bot-guide', type: ChannelType.GuildText, parent: info || undefined,
      topic: 'Alle HOPDOP-bottens kommandoer forklaret',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
        { id: config.roller['Spiller'], allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions] },
        ...STAFF.map(id => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] })),
      ],
    });
    config.kanaler.botguide = kanal.id;
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('#bot-guide er oprettet.');
  }
  const bc = `<#${config.kanaler.botcmd}>`;
  const emb = new EmbedBuilder().setColor(LILLA).setAuthor({ name: 'HOPDOP · Bot-guide' })
    .setTitle('🤖 Alt hvad HOPDOP Bot kan')
    .setDescription(`Skriv **/** i ${bc} for at se kommandoerne. Tal og stats kommer direkte fra Minecraft-serveren.`)
    .addFields(
      { name: '📊 Stats og lister', value: [
        '`/stats <spiller>` · kills, K/D, placering, team og duels, ligesom ingame',
        '`/top <liste>` · top 10 i kills, K/D, daily, duels, KOTH m.m.',
        '`/online` · hvem der er på serveren lige nu',
      ].join('\n') },
      { name: '🔗 Forbind Minecraft', value: [
        `<#${config.kanaler.link}> · tryk på knappen, eller brug \`/link\`, og skriv \`/discord <kode>\` ingame`,
        'Så får du automatisk din rank-rolle, og `/stats` viser dine egne stats',
        '`/unlink` · fjern forbindelsen',
      ].join('\n') },
      { name: '🌐 Server', value: [
        '`/ip` · serverens IP og hvordan du joiner',
        `<#${config.kanaler.serverip}> · IP og antal online, opdateres af sig selv`,
      ].join('\n') },
      { name: '📺 Kanaler der opdaterer sig selv', value: [
        `<#${config.kanaler.leaderboards}> · top 10 i kills, K/D, daily, duels og KOTH`,
        `<#${config.kanaler.serverstatus}> · er serveren oppe? 🟢/🔴`,
        `<#${config.kanaler.devlog}> · hvad der er nyt på serveren og Discorden`,
        `<#${config.kanaler.boosts}> · hvem der har boosted Discorden 💜`,
        `<#${config.kanaler.roller}> · vælg selv hvad du vil have ping om 🔔`,
      ].join('\n') },
      { name: '💡 Forslag', value: '`/forslag` · send en idé til serveren. Staff svarer, og du får en DM.' },
      { name: '🎫 Hjælp', value: `<#${config.kanaler.ticket}> · opret en ticket (support, køb, ansøgning eller anmeld en spiller)` },
      { name: '🔐 Private rum', value: `<#${config.kanaler.privatkanal}> · lav dit eget talerum med et valgfrit antal pladser. Andre skal bede dig om adgang.` },
      { name: '🎁 Events', value: [
        `Giveaways · tryk **Deltag** i <#${config.kanaler.giveaways}>`,
        `Ugens top 3 · hver søndag kl. 20 i <#${config.kanaler.events}>`,
      ].join('\n') },
      { name: '🛡️ Kun staff', value: '`/godkend` og `/afvis` · svar på forslag\n`/staffforslag` · send et forslag i #staff-forslag\n`/giveaway` · start en giveaway (vælg antal vindere)\n`/devlog` · skriv en opdatering i #dev-log\n`/censur til|fra` · slå spoiler-censur af grove ord til/fra\n`/cc <antal>` · ryd de sidste beskeder i kanalen (fx `/cc 40`)\n`/say` · send en pæn besked som botten' },
    )
    .setFooter({ text: `Stats, top og online virker kun i #bot-kommandoer · Hjemmeside: ${WEB.replace('https://', '')}` });
  const beskeder = await kanal.messages.fetch({ limit: 10 });
  const gammel = beskeder.find(m => m.author.id === client.user.id);
  if (gammel) await gammel.edit({ embeds: [emb] }); else await kanal.send({ embeds: [emb] });
}

// Kommandoer som almindelige spillere kun må bruge i #bot-kommandoer (staff må overalt)
const OFFENTLIGE = ['ip', 'forslag', 'stats', 'top', 'online', 'link'];

const erStaff = m => m.roles.cache.some(r => STAFF.includes(r.id));
const TYPER = { support: ['Support', '🛟'], koeb: ['Køb', '💳'], ansoeg: ['Ansøgning', '📝'], fejl: ['Anmeldelse', '🚨'], bug: ['Fejlrapport', '🐞'] };

const kommandoer = [
  new SlashCommandBuilder().setName('ip').setDescription('Vis serverens IP-adresse'),
  new SlashCommandBuilder().setName('top').setDescription('Se top 10 på et leaderboard')
    .addStringOption(o => o.setName('liste').setDescription('Hvilket leaderboard?').setRequired(true)
      .addChoices(...Object.entries(TOP).map(([value, t]) => ({ name: t.navn, value })))),
  new SlashCommandBuilder().setName('online').setDescription('Se hvem der er online på Hopdop'),
  new SlashCommandBuilder().setName('link').setDescription('Forbind din Discord med din Minecraft-konto og få din rank-rolle'),
  new SlashCommandBuilder().setName('unlink').setDescription('Fjern forbindelsen mellem din Discord og Minecraft'),
  new SlashCommandBuilder().setName('stats').setDescription('Se en spillers stats fra Hopdop')
    .addStringOption(o => o.setName('spiller').setDescription('Minecraft-navn (tom = dig selv, hvis du har brugt /link)').setRequired(false).setAutocomplete(true).setMaxLength(16)),
  new SlashCommandBuilder().setName('giveaway').setDescription('Start en giveaway')
    .addStringOption(o => o.setName('praemie').setDescription('Hvad kan man vinde?').setRequired(true))
    .addIntegerOption(o => o.setName('minutter').setDescription('Hvor mange minutter?').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addIntegerOption(o => o.setName('vindere').setDescription('Hvor mange vindere? (standard 1)').setMinValue(1).setMaxValue(10))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('forslag').setDescription('Send et forslag til serveren'),
  new SlashCommandBuilder().setName('staffforslag').setDescription('Send et forslag i #staff-forslag (staff)')
    .setDefaultMemberPermissions(P.ManageMessages),
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
  ...['ban', 'mute', 'kick'].map(ty => {
    const c = new SlashCommandBuilder().setName(ty).setDescription(`${ty === 'ban' ? 'Ban' : ty === 'mute' ? 'Mute' : 'Kick'} en spiller på Minecraft-serveren`)
      .addStringOption(o => o.setName('spiller').setDescription('Minecraft-navn').setRequired(true).setMaxLength(16))
      .addStringOption(o => o.setName('grund').setDescription('Grund (samme som i /straf ingame)').setRequired(true)
        .addChoices(...Object.entries(GRUNDE[ty]).map(([value, name]) => ({ name, value }))));
    if (ty !== 'kick') c.addStringOption(o => o.setName('tid').setDescription('Kun ved "Skriv selv": fx 30m, 12t, 7d eller perm').setMaxLength(10));
    return c.addStringOption(o => o.setName('besked').setDescription('Kun ved "Skriv selv": din egen grund').setMaxLength(150))
      .setDefaultMemberPermissions(P.Administrator);
  }),
  ...['unban', 'unmute', 'alts'].map(n => new SlashCommandBuilder().setName(n)
    .setDescription(n === 'alts' ? 'Find konti, der har spillet fra samme IP som spilleren' : `${n === 'unban' ? 'Fjern ban' : 'Fjern mute'} fra en spiller`)
    .addStringOption(o => o.setName('spiller').setDescription('Minecraft-navn').setRequired(true).setMaxLength(16))
    .setDefaultMemberPermissions(P.Administrator)),
  new SlashCommandBuilder().setName('genstart').setDescription('Genstart Minecraft-serveren (med nedtælling)')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Start genstart', value: 'start' }, { name: 'Annuller genstart', value: 'annuller' }, { name: 'Status', value: 'status' }))
    .addIntegerOption(o => o.setName('sekunder').setDescription('Nedtælling i sekunder (kun ved start)').setMinValue(5).setMaxValue(3600))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('beacondrop').setDescription('Start eller stop et Beacon Drop')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Start', value: 'start' }, { name: 'Stop', value: 'stop' }))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('broadcast').setDescription('Send en broadcast til alle ingame')
    .addStringOption(o => o.setName('besked').setDescription('Beskeden (farvekoder med & virker)').setRequired(true).setMaxLength(200))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('sig').setDescription('Skriv i chatten ingame som [Discord] dit navn')
    .addStringOption(o => o.setName('besked').setDescription('Beskeden').setRequired(true).setMaxLength(200))
    .addBooleanOption(o => o.setName('usynlig').setDescription('Ja = uden [Discord] og dit navn (ser ud som en systembesked)'))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('konsol').setDescription('Kør en konsol-kommando på Minecraft-serveren (pas på!)')
    .addStringOption(o => o.setName('kommando').setDescription('Uden /, fx: say Hej alle').setRequired(true).setMaxLength(250))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('adgang').setDescription('Styr hvem der må bruge server-kommandoerne (kun Ejer)')
    .addStringOption(o => o.setName('handling').setDescription('Hvad vil du?').setRequired(true)
      .addChoices({ name: 'Vis adgang', value: 'vis' }, { name: 'Giv en rolle adgang', value: 'giv' }, { name: 'Fjern en rolles adgang', value: 'fjern' }))
    .addStringOption(o => o.setName('kommando').setDescription('Hvilken kommando?')
      .addChoices(...Object.entries(ADGANG_KOMMANDOER).map(([value, b]) => ({ name: `${value} · ${b}`.slice(0, 100), value }))))
    .addRoleOption(o => o.setName('rolle').setDescription('Hvilken rolle?'))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('samtalevagt').setDescription('Test samtale-vagten (staff er normalt undtaget)')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Test til (staff tæller med)', value: 'til' }, { name: 'Test fra', value: 'fra' }, { name: 'Status', value: 'status' }))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('event').setDescription('Opret et planlagt event i Discord (staff)')
    .addStringOption(o => o.setName('titel').setDescription('Eventets navn, fx KOTH-turnering').setRequired(true))
    .addIntegerOption(o => o.setName('starter_om').setDescription('Starter om hvor mange minutter?').setRequired(true).setMinValue(5).setMaxValue(60 * 24 * 14))
    .addStringOption(o => o.setName('type').setDescription('Hvilken slags event?').addChoices({ name: 'Event', value: 'Event' }, { name: 'KOTH', value: 'KOTH' }, { name: 'Giveaway', value: 'Giveaway' }, { name: 'Turnering', value: 'Turnering' }))
    .addIntegerOption(o => o.setName('varighed').setDescription('Hvor mange minutter varer det? (standard 60)').setMinValue(5).setMaxValue(720))
    .addStringOption(o => o.setName('beskrivelse').setDescription('Kort beskrivelse (valgfri)'))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('emojis').setDescription('Tilføj egne emojis fra mappen "emojis" (admin)').setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('goons').setDescription('Giv eller fjern Goons-rollen (kun to udvalgte)')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true).addChoices({ name: 'Giv', value: 'giv' }, { name: 'Fjern', value: 'fjern' }))
    .addUserOption(o => o.setName('bruger').setDescription('Hvem?').setRequired(true)),
  new SlashCommandBuilder().setName('censur').setDescription('Slå censur (grove ord som spoilers) til eller fra')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Slå til', value: 'til' }, { name: 'Slå fra (vis ordene)', value: 'fra' }, { name: 'Status', value: 'status' }))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('screenshare').setDescription('Giv eller fjern adgang til at screenshare (staff)')
    .addUserOption(o => o.setName('bruger').setDescription('Hvem?').setRequired(true))
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Giv i 30 minutter', value: '30' }, { name: 'Giv i 1 time', value: '60' }, { name: 'Fjern nu', value: 'fjern' }))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('layout').setDescription('Opdel kanalerne i pæne kategorier (kun Ejer)')
    .addStringOption(o => o.setName('handling').setDescription('Hvad skal ske?').setRequired(true)
      .addChoices({ name: 'Opdel kanalerne', value: 'anvend' }, { name: 'Fortryd (sæt det tilbage)', value: 'fortryd' }))
    .setDefaultMemberPermissions(P.Administrator),
  new SlashCommandBuilder().setName('cc').setDescription('Ryd de sidste beskeder i denne kanal (staff)')
    .addIntegerOption(o => o.setName('antal').setDescription('Hvor mange beskeder? (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(P.ManageMessages),
  new SlashCommandBuilder().setName('devlog').setDescription('Skriv en opdatering i #dev-log (staff)')
    .setDefaultMemberPermissions(P.ManageMessages),
].map(c => c.toJSON());

client.once('clientReady', async () => {
  console.log('Online som', client.user.tag);
  client.user.setPresence({ activities: [{ name: 'Hopdop', type: ActivityType.Playing }], status: 'online' });
  opdaterStatus(); setInterval(opdaterStatus, 120000);
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.commands.set(kommandoer);
  console.log('Kommandoer registreret.');
  await opdaterIpKanal(guild).catch(e => console.error('Kunne ikke opdatere #server-ip:', e.message));
  for (const id of Object.keys(gwData)) planlaegGiveaway(id);
  await findGlemteGiveaways().catch(e => console.error('Glemte giveaways:', e.message));
  if (Object.keys(gwData).length) console.log(`${Object.keys(gwData).length} giveaway(s) fortsætter.`);
  setInterval(tjekUgeTop, 60000); tjekUgeTop();
  tjekHjemmeside(); setInterval(tjekHjemmeside, 120000);
  tjekLinks(); setInterval(tjekLinks, 30000);
  await opdaterLeaderboards(); setInterval(opdaterLeaderboards, 5 * 60000);
  await opdaterServerStatus(); setInterval(opdaterServerStatus, 2 * 60000);
  await opdaterStatsKategori(); setInterval(opdaterStatsKategori, 10 * 60000);
  await opdaterLinkKanal(guild).catch(e => console.error('#link:', e.message));
  await opdaterBoostHoved(guild);
  await saetBotLogo();
  await opdaterLiveChatAdgang(guild).catch(e => console.error('#live-chat:', e.message));
  await opsaetLogs(guild).catch(e => console.error('Logs:', e.message));
  await botLogKanal().catch(e => console.error('#bot-logs:', e.message));
  tjekBro(); setInterval(tjekBro, 3000);
  await saetGrafik(guild).catch(e => console.error('Grafik:', e.message));
  await synkRollerFil(true); setInterval(synkRollerFil, 60000);
  await opsaetRettigheder(guild).catch(e => console.error('Rettigheder:', e.message));
  await opsaetSupport(guild).catch(e => console.error('Support:', e.message)); setInterval(() => opdaterAktive(), 60000);
  tjekScreenshare(); setInterval(tjekScreenshare, 30000);
  setInterval(() => { laasPings(guild).catch(() => {}); laasLaeseKanaler(guild).catch(() => {}); }, 5 * 60000);
  await opdaterGuide(guild).catch(e => console.error('Kunne ikke opdatere #bot-guide:', e.message));
  await opsaetAutoMod(guild).catch(e => console.error('AutoMod:', e.message));
  postDevlog(); setInterval(postDevlog, 60000);
  setInterval(postDiscordAendringer, 30 * 60000);
  if (!botNoegle()) console.log('BOT_NOEGLE mangler i .env - ansøgninger og straffe postes, så snart den er tilføjet.');
});

// Skriver (eller retter) IP-beskeden i #server-ip, hver gang botten starter
let ipBesked = null; // beskeden i #server-ip, så online-tallet kan opdateres
let sidstOnline = null;
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
    .addFields({ name: '🟢 Online lige nu', value: await onlineTekst() })
    .setFooter({ text: 'Du kan altid skrive /ip i #bot-kommandoer' });
  const beskeder = await kanal.messages.fetch({ limit: 20 });
  const gammel = beskeder.find(m => m.author.id === client.user.id);
  ipBesked = gammel ? await gammel.edit({ content: '', embeds: [embed] }) : await kanal.send({ embeds: [embed] });
  console.log('#server-ip er opdateret.');
}

// Velkomstbesked
client.on('guildMemberAdd', async member => {
  const ch = member.guild.channels.cache.get(config.kanaler.velkommen);
  if (!ch) return;
  ch.send({ content: `${member}`, embeds: [new EmbedBuilder().setColor(FARVE)
    .setTitle('👋 Velkommen til Hopdop!')
    .setDescription(`Hej ${member}, vi er glade for at have dig her!\nLæs <#${config.kanaler.regler}> og tryk på knappen for at få adgang.\nDu er medlem nr. **${member.guild.memberCount}**.`)
    .setThumbnail(member.user.displayAvatarURL())
    .setImage(fs.existsSync('assets/banner.png') ? 'attachment://banner.png' : null)],
    files: fs.existsSync('assets/banner.png') ? [new AttachmentBuilder('assets/banner.png', { name: 'banner.png' })] : [] }).catch(() => {});
});

client.on('interactionCreate', async i => {
  try {
    // ---------- STATS: forslag til navne mens man skriver ----------
    if (i.isAutocomplete() && i.commandName === 'stats') {
      const skrevet = i.options.getFocused().toLowerCase();
      const stats = await hentWeb('stats').catch(() => ({ spillere: [] }));
      const navne = stats.spillere.map(s => s.n).filter(n => n.toLowerCase().startsWith(skrevet)).slice(0, 25);
      return i.respond(navne.map(n => ({ name: n, value: n }))).catch(() => {});
    }

    // ---------- DEVLOG: MODAL ----------
    if (i.isModalSubmit() && i.customId.startsWith('privat_')) return privatModal(i);
    if (i.isModalSubmit() && i.customId === 'tilkald_modal') {
      const sidst = tilkaldCooldown.get(i.user.id) || 0;
      if (Date.now() - sidst < TILKALD_VENT) return i.reply({ content: `⏳ Du kan tilkalde staff igen om ${Math.ceil((TILKALD_VENT - (Date.now() - sidst)) / 60000)} min.`, flags: MessageFlags.Ephemeral });
      tilkaldCooldown.set(i.user.id, Date.now());
      await tilkaldStaff(i, i.fields.getTextInputValue('grund').slice(0, 300).replace(/\n/g, ' '));
      return i.reply({ content: '✅ Staff er tilkaldt! Gå ind i talekanalen **⏳┃Afventer support**, så trækker en fra staff dig ned.', flags: MessageFlags.Ephemeral });
    }
    if (i.isModalSubmit() && i.customId === 'devlog_modal') {
      const kanal = await client.channels.fetch(config.kanaler.devlog).catch(() => null);
      if (!kanal) return i.reply({ content: '#dev-log findes ikke.', flags: MessageFlags.Ephemeral });
      const punkter = i.fields.getTextInputValue('punkter').split('\n').map(x => x.trim()).filter(Boolean);
      await kanal.send({ embeds: [devlogEmbed(i.fields.getTextInputValue('titel'), punkter).setFooter({ text: `Skrevet af ${i.user.username}` })] });
      return i.reply({ content: `Dev-loggen er sendt i ${kanal}. 🛠️`, flags: MessageFlags.Ephemeral });
    }

    // ---------- STAFF-FORSLAG: MODAL ----------
    if (i.isModalSubmit() && i.customId === 'staffforslag_modal') {
      const tekst = i.fields.getTextInputValue('tekst').trim();
      const kanal = i.guild.channels.cache.get(config.kanaler.staffforslag);
      if (!kanal) return i.reply({ content: '#staff-forslag findes ikke endnu.', flags: MessageFlags.Ephemeral });
      const sid = lavSid();
      const msg = await kanal.send({ embeds: [new EmbedBuilder().setColor(FARVE).setTitle('Nyt staff-forslag!')
        .addFields({ name: 'Indsender', value: `${i.user} (${i.user.username})` }, { name: 'Forslag', value: tekst.slice(0, 1000) })
        .setFooter({ text: `Bruger-ID: ${i.user.id} | sID: ${sid} • ${dato()}` })] });
      await msg.react('✅'); await msg.react('❌');
      const d = hentForslag(); d[sid] = { msg: msg.id, user: i.user.id, ign: i.user.username, tekst, kanal: kanal.id }; gemForslag(d);
      return i.reply({ content: `✅ Dit forslag er sendt til ${kanal}. (sID: \`${sid}\`)`, flags: MessageFlags.Ephemeral });
    }

    // ---------- FORSLAG: MODAL ----------
    if (i.isModalSubmit() && i.customId === 'forslag_modal') {
      const ign = i.fields.getTextInputValue('ign').trim();
      const tekst = i.fields.getTextInputValue('tekst').trim();
      const sid = lavSid();
      const traad = await opretForslagTraad(i.guild, sid, ign, i.user, tekst);
      if (traad) {
        const d = hentForslag(); d[sid] = { msg: traad.id, kanal: traad.id, user: i.user.id, ign, tekst }; gemForslag(d);
        forslagCd.set(i.user.id, Date.now());
        return i.reply({ content: `✅ Dit forslag er sendt til ${traad}. (sID: \`${sid}\`)`, flags: MessageFlags.Ephemeral });
      }
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
      if (OFFENTLIGE.includes(i.commandName) && i.channelId !== config.kanaler.botcmd && !erStaff(i.member))
        return i.reply({ content: `Brug kommandoer i <#${config.kanaler.botcmd}> 🙂`, flags: MessageFlags.Ephemeral });
      if (i.commandName === 'link') return i.reply(linkSvar(i.user.id));
      if (i.commandName === 'unlink') return i.reply(await unlinkSvar(i.guild, i.user.id));
      if (i.commandName === 'top' || i.commandName === 'online') {
        await i.deferReply();
        const emb = await (i.commandName === 'top' ? lavTopEmbed(i.options.getString('liste')) : lavOnlineEmbed())
          .catch(e => { console.error('Web-fejl:', e.message); return null; });
        return i.editReply(emb ? { embeds: [emb] } : 'Kunne ikke hente data lige nu. Prøv igen om lidt.');
      }
      if (i.commandName === 'staffforslag') {
        if (!erStaff(i.member)) return i.reply({ content: 'Kun staff kan bruge den.', flags: MessageFlags.Ephemeral });
        return i.showModal(new ModalBuilder().setCustomId('staffforslag_modal').setTitle('Nyt staff-forslag').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tekst').setLabel('Dit forslag').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000))));
      }
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
        const kanal = await client.channels.fetch(f.kanal || config.kanaler.forslag).catch(() => null);
        const msg = kanal && await kanal.messages.fetch(f.msg).catch(() => null);
        if (!msg) return i.reply({ content: 'Forslagsbeskeden er slettet.', flags: MessageFlags.Ephemeral });
        const emb = EmbedBuilder.from(msg.embeds[0]).setColor(ok ? 0x22c55e : 0xef4444)
          .setTitle(ok ? '✅ Forslag godkendt' : '❌ Forslag afvist')
          .addFields({ name: `${ok ? 'Godkendt' : 'Afvist'} af ${i.user.username}`, value: svar || 'Ingen begrundelse.' });
        await msg.edit({ embeds: [emb] });
        await saetForumTag(kanal, ok ? 'Godkendt' : 'Afvist');
        f.status = ok ? 'godkendt' : 'afvist'; gemForslag(d);
        const bruger = await client.users.fetch(f.user).catch(() => null);
        if (bruger) bruger.send(`Dit forslag er blevet **${ok ? 'godkendt' : 'afvist'}**: "${f.tekst.slice(0, 200)}"${svar ? `\nBegrundelse: ${svar}` : ''}`).catch(() => {});
        return i.reply({ content: `Forslag \`${sid}\` er ${ok ? 'godkendt' : 'afvist'}.`, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'stats') {
        await i.deferReply();
        const navn = (i.options.getString('spiller') || linkAf(i.user.id)?.n || '').trim();
        if (!navn) return i.editReply('Skriv et navn, fx `/stats krainer2`. Eller brug `/link`, så viser `/stats` dine egne stats.');
        const emb = await lavStatsEmbed(navn).catch(e => { console.error('Stats-fejl:', e.message); return 'fejl'; });
        if (emb === 'fejl') return i.editReply('Kunne ikke hente stats lige nu. Prøv igen om lidt.');
        if (!emb) return i.editReply(`Fandt ingen spiller ved navn **${navn}**. Spilleren skal have været på serveren.`);
        return i.editReply({ embeds: [emb] });
      }
      if (i.commandName === 'ip') {
        return i.reply({ embeds: [new EmbedBuilder().setColor(FARVE).setTitle('🌐 Serverens IP').setDescription(`\`${SERVER_IP}\`\n\n⚠️ ${IP_NOTE}`)] });
      }
      // ---------- SERVER-KOMMANDOER (bro til Minecraft) ----------
      if (i.commandName in ADGANG_KOMMANDOER || i.commandName === 'adgang') {
        if (i.commandName === 'adgang') {
          if (!erEjer(i.member)) return i.reply({ content: 'Kun Ejer kan ændre adgang.', flags: MessageFlags.Ephemeral });
          const h = i.options.getString('handling'), k = i.options.getString('kommando'), r = i.options.getRole('rolle');
          if (h === 'vis') return i.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(LILLA).setTitle('🔐 Adgang til server-kommandoer')
            .setDescription(Object.entries(ADGANG_KOMMANDOER).map(([kk, b]) => `**/${kk}** · ${b}\n> ${(adgang[kk] || []).join(', ') || 'Kun Ejer'}`).join('\n'))
            .setFooter({ text: 'Ejer har altid adgang til alt. Brug /adgang giv eller fjern.' })] });
          if (!k || !r) return i.reply({ content: 'Vælg både en kommando og en rolle.', flags: MessageFlags.Ephemeral });
          const liste = new Set(adgang[k] || []);
          if (h === 'giv') liste.add(r.name); else liste.delete(r.name);
          adgang[k] = [...liste]; gemAdgang();
          if (k === 'livechat') await opdaterLiveChatAdgang(i.guild);
          return i.reply({ content: `${h === 'giv' ? '✅' : '🗑️'} **${r.name}** ${h === 'giv' ? 'har nu adgang til' : 'har ikke længere adgang til'} **/${k}**.`, flags: MessageFlags.Ephemeral });
        }
        if (!harAdgang(i.member, i.commandName)) return i.reply({ content: '🔒 Du har ikke adgang til denne kommando. Spørg Ejer om /adgang.', flags: MessageFlags.Ephemeral });
        if (!botNoegle()) return i.reply({ content: 'BOT_NOEGLE mangler i .env.', flags: MessageFlags.Ephemeral });
        const sp = i.options.getString('spiller');
        if (sp !== null && !MC_NAVN.test(sp)) return i.reply({ content: 'Det er ikke et gyldigt Minecraft-navn.', flags: MessageFlags.Ephemeral });
        const dnavn = i.user.username.replace(/[^A-Za-z0-9_.]/g, '').slice(0, 32) || 'Discord';
        const ren = t => String(t || '').replace(/[\r\n]+/g, ' ').trim();
        switch (i.commandName) {
          case 'ban': case 'mute': case 'kick': {
            const ty = i.commandName, g = i.options.getString('grund');
            let tid = (i.options.getString('tid') || '-').toLowerCase().trim();
            if (g === 'custom' && ty !== 'kick' && !/^(\d+[mtd]|perm)$/.test(tid)) return i.reply({ content: 'Ved "Skriv selv" skal du angive en tid, fx `30m`, `12t`, `7d` eller `perm`.', flags: MessageFlags.Ephemeral });
            if (!/^(\d+[mtd]|perm|-)$/.test(tid)) tid = '-';
            const besked = ren(i.options.getString('besked')) || `${GRUNDE[ty][g]} (fra Discord)`;
            return tilServer(i, `dc:straf ${ty} ${sp} ${g} ${tid} ${dnavn} ${besked}`, `${ty.toUpperCase()} af **${sp}** (${GRUNDE[ty][g]})`);
          }
          case 'unban': return tilServer(i, `unban ${sp}`, `Unban af **${sp}**`);
          case 'unmute': return tilServer(i, `unmute ${sp}`, `Unmute af **${sp}**`);
          case 'alts': return tilServer(i, `dc:alts ${sp}`, `Alt-tjek af **${sp}**`);
          case 'genstart': {
            const h = i.options.getString('handling'), sek = i.options.getInteger('sekunder');
            return tilServer(i, `genstart ${h}${h === 'start' && sek ? ` ${sek}` : ''}`, `Genstart: ${h}${sek && h === 'start' ? ` (${sek} sek.)` : ''}`);
          }
          case 'beacondrop': return tilServer(i, `bd ${i.options.getString('handling')}`, `Beacon Drop: ${i.options.getString('handling')}`);
          case 'broadcast': return tilServer(i, `bc ${ren(i.options.getString('besked'))}`, 'Broadcast');
          case 'sig': {
            const tekst = ren(i.options.getString('besked'));
            return tilServer(i, i.options.getBoolean('usynlig') ? `dc:sigstille ${tekst}` : `dc:sig ${dnavn} ${tekst}`, 'Besked ingame', true);
          }
          case 'konsol': return tilServer(i, ren(i.options.getString('kommando')).replace(/^\//, ''), `Konsol: \`${ren(i.options.getString('kommando')).replace(/`/g, "'")}\``);
          default: return i.reply({ content: 'Ukendt kommando.', flags: MessageFlags.Ephemeral });
        }
      }
      if (i.commandName === 'samtalevagt') {
        if (!i.memberPermissions?.has(P.Administrator)) return i.reply({ content: 'Kun admins kan bruge den.', flags: MessageFlags.Ephemeral });
        const h = i.options.getString('handling'); if (h === 'til') samtaleTest = true; else if (h === 'fra') samtaleTest = false;
        return i.reply({ flags: MessageFlags.Ephemeral, content: `💬 Samtale-vagt test er **${samtaleTest ? 'TIL' : 'FRA'}**.\n${samtaleTest ? 'Staff tæller nu med, så du kan teste: skriv ca. 12 beskeder frem og tilbage med en anden i #medier, #memes eller #bot-kommandoer. Husk at slå testen fra bagefter (den slås også fra ved genstart).' : 'Staff er undtaget.'}\nVagten kigger kun i medier, memes og bot-kommandoer – ikke i #chat.` });
      }
      if (i.commandName === 'event') {
        if (!i.memberPermissions?.has(P.ManageMessages)) return i.reply({ content: 'Kun staff kan oprette events.', flags: MessageFlags.Ephemeral });
        return opretEvent(i);
      }
      if (i.commandName === 'emojis') {
        if (!i.memberPermissions?.has(P.Administrator)) return i.reply({ content: 'Kun admins kan bruge den.', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const r = await opsaetEmojiMappe(i.guild).catch(e => ({ nye: [], sprunget: [], fejl: [e.message] }));
        const p = await opsaetPynt(i.guild, true).catch(e => ({ nye: 0, fejl: [e.message] }));
        if (p.nye || p.fejl.length) r.nye.push(...Array(p.nye).fill('HopDop-emoji')); if (p.fejl.length) r.fejl.push(...p.fejl.slice(0, 3));
        if (p.fejl.length && /permission|access/i.test(p.fejl.join())) r.fejl.push('Botten mangler rettigheden **Create Expressions** (Server Settings → Roller → bot-rollen)');
        return i.editReply(`😀 **Tilføjet:** ${r.nye.length ? r.nye.map(n => `\`${n}\``).join(', ') : 'ingen nye'}\n⏭️ Findes allerede: ${r.sprunget.length}\n${r.fejl.length ? `⚠️ Fejl: ${r.fejl.join('; ')}` : 'Mappen hedder `emojis` ved siden af index.js.'}`);
      }
      if (i.commandName === 'goons') {
        if (!GOONS_UDDELERE.includes(i.user.id)) return i.reply({ content: 'Kun to udvalgte personer kan dele Goons-rollen ud.', flags: MessageFlags.Ephemeral });
        const r = goonsRolle(i.guild); const m = i.options.getMember('bruger');
        if (!r || !m) return i.reply({ content: 'Fandt ikke rollen eller brugeren.', flags: MessageFlags.Ephemeral });
        if (i.options.getString('handling') === 'giv') { goonsBotGiver.add(m.id); await m.roles.add(r, `Goons givet af ${i.user.username}`); }
        else await m.roles.remove(r, `Goons fjernet af ${i.user.username}`);
        return i.reply({ content: `😈 ${m} ${i.options.getString('handling') === 'giv' ? 'er nu' : 'er ikke længere'} **Goons**.`, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'censur') {
        if (!i.memberPermissions?.has(P.ManageMessages)) return i.reply({ content: 'Kun staff kan styre censuren.', flags: MessageFlags.Ephemeral });
        const h = i.options.getString('handling');
        if (h === 'til') saetCensur(true); else if (h === 'fra') saetCensur(false);
        return i.reply({ flags: MessageFlags.Ephemeral, content: `🔞 Censur er **${censurTil ? 'TIL' : 'FRA'}**.\n`
          + `• Live-chat: ${censurTil ? 'grove ord vises som spoilers' : 'ordene vises som de er'}\n`
          + `• Discord-chatten: ${!censurTil ? 'ikke censureret' : MESSAGE_CONTENT ? 'grove ord bliver til spoilers' : '⚠️ virker ikke endnu – slå **Message Content Intent** til i Developer Portal (Bot) og genstart botten'}` });
      }
      if (i.commandName === 'screenshare') {
        if (!i.memberPermissions?.has(P.ManageMessages)) return i.reply({ content: 'Kun staff kan styre screenshare.', flags: MessageFlags.Ephemeral });
        const bruger = i.options.getMember('bruger'); const h = i.options.getString('handling');
        if (!bruger) return i.reply({ content: 'Fandt ikke brugeren på serveren.', flags: MessageFlags.Ephemeral });
        const rolle = await ssRolle(i.guild); if (!rolle) return i.reply({ content: 'Kunne ikke finde/oprette rollen Screenshare.', flags: MessageFlags.Ephemeral });
        if (h === 'fjern') {
          await bruger.roles.remove(rolle).catch(() => {}); delete ssData[bruger.id]; gemSs();
          return i.reply({ content: `🖥️ ${bruger} kan ikke screenshare længere.`, flags: MessageFlags.Ephemeral });
        }
        await bruger.roles.add(rolle, `Screenshare af ${i.user.username}`).catch(e => console.error('Screenshare:', e.message));
        ssData[bruger.id] = Date.now() + Number(h) * 60000; gemSs();
        logBro(i.user, `screenshare ${bruger.user.username} ${h} min`);
        return i.reply({ content: `🖥️ ${bruger} må screenshare i **${h === '60' ? '1 time' : '30 minutter'}**. Så fjerner botten adgangen igen.`, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'layout') {
        if (!erEjer(i.member)) return i.reply({ content: 'Kun Ejer kan ændre layoutet.', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        if (i.options.getString('handling') === 'fortryd') {
          const r = await layoutFortryd(i.guild).catch(e => { console.error('Layout:', e.message); return null; });
          return i.editReply(r ? `↩️ Layoutet er sat tilbage (${r.kanaler} kanaler).` : '❌ Der er ingen backup at gå tilbage til.');
        }
        const r = await layoutAnvend(i.guild).catch(e => { console.error('Layout:', e.message); return null; });
        return i.editReply(r ? `✅ Kanalerne er opdelt: **${r.flyttet}** kanaler i **${r.kategorier}** kategorier${r.nye ? ` (${r.nye} nye)` : ''}.\nStaff-kategorierne er ikke rørt. Kører du \`/layout fortryd\`, sætter jeg alt tilbage.` : '❌ Noget gik galt, se terminalen.');
      }
      if (i.commandName === 'cc') {
        if (!i.memberPermissions?.has(P.ManageMessages)) return i.reply({ content: 'Kun staff kan rydde chatten.', flags: MessageFlags.Ephemeral });
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        const slettet = await i.channel.bulkDelete(i.options.getInteger('antal'), true).catch(e => { console.error('/cc:', e.message); return null; });
        if (!slettet) return i.editReply('❌ Kunne ikke rydde her. Mangler jeg rettigheden Administrer beskeder?');
        // Rydder du en kanal med et panel (ansøgninger, fejlrapporter, opret-ticket), sætter botten panelet op igen
        if ([config.kanaler.ansog, config.kanaler.fejl, config.kanaler.ticket, config.kanaler.forslag, config.kanaler.tilkald, config.kanaler.staffforslag].includes(i.channelId)) {
          const g = i.guild; opsaetRettigheder(g).catch(() => {}).then(() => opsaetSupport(g)).catch(() => {});
        }
        return i.editReply(`🧹 Ryddede **${slettet.size}** ${slettet.size === 1 ? 'besked' : 'beskeder'}.${slettet.size < i.options.getInteger('antal') ? '\n(Beskeder ældre end 14 dage kan Discord ikke slette i bulk.)' : ''}`);
      }
      if (i.commandName === 'devlog') {
        return i.showModal(new ModalBuilder().setCustomId('devlog_modal').setTitle('Ny dev-log').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titel').setLabel('Overskrift').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('punkter').setLabel('Hvad er nyt? (én ting pr. linje)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3000))));
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
        const g = { kanal: kanal.id, praemie, slut, af: i.user.id, vindere: i.options.getInteger('vindere') || 1, deltagere: [] };
        const msg = await sendPing(kanal, 'Giveaway', {
          embeds: [gwEmbed(g, 0)],
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw').setLabel('Deltag').setEmoji('🎉').setStyle(ButtonStyle.Primary))],
        });
        gwData[msg.id] = g;
        planlaegGiveaway(msg.id); gemGw();
        return i.reply({ content: `Giveaway startet i ${kanal}.`, flags: MessageFlags.Ephemeral });
      }
    }

    if (!i.isButton()) return;
    if (i.customId.startsWith('privat_')) return privatKnap(i);
    if (i.customId === 'tilkald') {
      const sidst = tilkaldCooldown.get(i.user.id) || 0;
      if (Date.now() - sidst < TILKALD_VENT) return i.reply({ content: `⏳ Du kan tilkalde staff igen om ${Math.ceil((TILKALD_VENT - (Date.now() - sidst)) / 60000)} min.`, flags: MessageFlags.Ephemeral });
      return i.showModal(new ModalBuilder().setCustomId('tilkald_modal').setTitle('Tilkald staff').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('grund').setLabel('Hvad har du brug for hjælp til?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200))));
    }

    // ---------- GIVEAWAY ----------
    if (i.customId === 'gw') {
      const s = giveaways.get(i.message.id);
      if (!s) return i.reply({ content: 'Giveaway er slut.', flags: MessageFlags.Ephemeral });
      if (s.has(i.user.id)) { s.delete(i.user.id); await i.reply({ content: 'Du er meldt fra.', flags: MessageFlags.Ephemeral }); }
      else { s.add(i.user.id); await i.reply({ content: 'Du er med! 🎉', flags: MessageFlags.Ephemeral }); }
      gemGw();
      const g = gwData[i.message.id];
      return i.message.edit({ embeds: [g ? gwEmbed(g, s.size) : i.message.embeds[0]] }).catch(() => {});
    }
    if (i.customId === 'link_start') return i.reply(linkSvar(i.user.id));
    if (i.customId === 'link_fjern') return i.reply(await unlinkSvar(i.guild, i.user.id));
    if (i.customId === 'link_status') {
      const l = linkAf(i.user.id);
      return i.reply({ content: l ? `✅ Du er forbundet med **${l.n}**.` : '❌ Du er ikke forbundet endnu. Tryk på **Forbind min konto**.', flags: MessageFlags.Ephemeral });
    }
    if (i.customId === 'gw_reroll') {
      if (!erStaff(i.member)) return i.reply({ content: 'Kun staff kan trække en ny vinder.', flags: MessageFlags.Ephemeral });
      const g = gwSlut[i.message.id];
      if (!g) return i.reply({ content: 'Jeg kan ikke finde deltagerne til denne giveaway længere.', flags: MessageFlags.Ephemeral });
      const tilbage = g.deltagere.filter(d => !g.vundet.includes(d));
      if (!tilbage.length) return i.reply({ content: 'Der er ingen flere deltagere at trække imellem.', flags: MessageFlags.Ephemeral });
      const ny = traek(tilbage, 1);
      g.vundet.push(...ny); gemGwSlut();
      await i.reply({ content: `Ny vinder trukket: <@${ny[0]}>`, flags: MessageFlags.Ephemeral });
      return udraabVindere(i.channel, i.message.id, g, ny, true);
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
        parent: config.kanaler.aktivkat || config.kanaler.support,
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
          .setDescription((type === 'bug'
            ? 'Beskriv fejlen:\n**1.** Hvad skete der?\n**2.** Hvad forventede du?\n**3.** Hvordan kan vi gentage den? (gerne med billede/video)\n\n'
            : 'Beskriv dit problem så detaljeret som muligt, så hjælper en fra staff dig snarest.\n') + 'Når I er færdige, tryk på knappen for at lukke ticketten.')],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_luk').setLabel('Luk ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger))],
      });
      if (type === 'bug') opretFejlTraad(i.guild, kanal, i.user);
      opdaterAktive(i.guild);
      return i.reply({ content: `Din ticket er oprettet: ${kanal}`, flags: MessageFlags.Ephemeral });
    }

    if (i.customId === 'ticket_luk') {
      const ejerId = (i.channel.topic || '').replace('ticket:', '');
      if (!erStaff(i.member) && i.user.id !== ejerId) return i.reply({ content: 'Kun staff eller ticket-ejeren kan lukke.', flags: MessageFlags.Ephemeral });
      await i.reply('🔒 Ticketten lukkes om 5 sekunder...');
      const log = i.guild.channels.cache.get(config.kanaler.ticketlog);
      const udskrift = await lavUdskrift(i.channel, i.user).catch(e => { console.error('Udskrift fejlede:', e.message); return null; });
      if (log) log.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('📁 Ticket lukket')
        .setDescription(`Kanal: **${i.channel.name}**\nEjer: <@${ejerId}>\nLukket af: ${i.user}${udskrift ? `\nBeskeder: **${udskrift.antal}**` : '\n⚠️ Udskriften kunne ikke gemmes.'}`)],
        components: udskrift ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Se samtalen').setEmoji('📜').setStyle(ButtonStyle.Link).setURL(udskrift.link))] : [] }).catch(() => {});
      afslutFejlTraad(i.guild, i.channel.id);
      setTimeout(() => i.channel.delete().catch(() => {}).then(() => opdaterAktive(i.guild)), 5000);
    }
  } catch (e) {
    console.error('Fejl:', e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: 'Der skete en fejl.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

if (!MESSAGE_CONTENT) console.log('Censur (spoiler på grove ord) er slået fra: tænd "Message Content Intent" i Developer Portal -> Bot, og genstart botten.');
client.login(process.env.TOKEN);
