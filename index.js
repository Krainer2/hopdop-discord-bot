// HOPDOP Discord bot - kør med: node index.js
// (c) 2026 Krainer2
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits: P, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageFlags, ActivityType, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');

const FARVE = 0x3b82f6;
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const STAFF = ['Ejer', 'Admin', 'Mod', 'Hjælper'].map(n => config.roller[n]);
const SERVER_IP = process.env.SERVER_IP || 'hopdop.superawesome.dk';
const IP_NOTE = 'Da vi ikke har VIP, kan du ikke connecte direkte til Hopdop. Join med IP\'en ovenfor, og følg instrukserne, der kommer i chatten.';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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
    const kanal = await client.channels.fetch(config.kanaler.staffchat).catch(() => null);
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
      await kanal.send({ embeds: [devlogEmbed(d.titel || 'Opdatering', d.punkter || [], d.kategori)] });
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

// ---------- TICKET-UDSKRIFT: hele samtalen som .txt-fil ----------
async function lavUdskrift(kanal) {
  let alle = [], foer;
  for (let n = 0; n < 20; n++) { // op til 2000 beskeder
    const bunke = await kanal.messages.fetch({ limit: 100, before: foer });
    if (!bunke.size) break;
    alle.push(...bunke.values()); foer = bunke.last().id;
    if (bunke.size < 100) break;
  }
  alle = alle.reverse();
  const tid = d => d.toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const linjer = [`Ticket: ${kanal.name}`, `Lukket: ${tid(new Date())}`, `Beskeder: ${alle.length}`, ''.padEnd(50, '-')];
  for (const m of alle) {
    let tekst = m.content || '';
    for (const e of m.embeds) tekst += `${tekst ? ' ' : ''}[Embed: ${[e.title, e.description].filter(Boolean).join(' - ')}]`;
    for (const a of m.attachments.values()) tekst += ` [Fil: ${a.url}]`;
    linjer.push(`[${tid(m.createdAt)}] ${m.author.username}${m.author.bot ? ' (bot)' : ''}: ${tekst.trim() || '(tom)'}`);
  }
  const navn = kanal.name.replace(/[^a-zA-Z0-9æøåÆØÅ_-]/g, '') || 'ticket';
  return { antal: alle.length, fil: new AttachmentBuilder(Buffer.from(linjer.join('\n'), 'utf8'), { name: `ticket-${navn}.txt` }) };
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
    await kanal.send({ embeds: [emb] });
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
        '`/link` · få en kode, og skriv `/discord <kode>` ingame',
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
      ].join('\n') },
      { name: '💡 Forslag', value: '`/forslag` · send en idé til serveren. Staff svarer, og du får en DM.' },
      { name: '🎫 Hjælp', value: `<#${config.kanaler.ticket}> · opret en ticket (support, køb, ansøgning eller anmeld en spiller)` },
      { name: '🎁 Events', value: [
        `Giveaways · tryk **Deltag** i <#${config.kanaler.giveaways}>`,
        `Ugens top 3 · hver søndag kl. 20 i <#${config.kanaler.events}>`,
      ].join('\n') },
      { name: '🛡️ Kun staff', value: '`/godkend` og `/afvis` · svar på forslag\n`/giveaway` · start en giveaway (vælg antal vindere)\n`/devlog` · skriv en opdatering i #dev-log\n`/say` · send en pæn besked som botten' },
    )
    .setFooter({ text: `Stats, top og online virker kun i #bot-kommandoer · Hjemmeside: ${WEB.replace('https://', '')}` });
  const beskeder = await kanal.messages.fetch({ limit: 10 });
  const gammel = beskeder.find(m => m.author.id === client.user.id);
  if (gammel) await gammel.edit({ embeds: [emb] }); else await kanal.send({ embeds: [emb] });
}

// Kommandoer som almindelige spillere kun må bruge i #bot-kommandoer (staff må overalt)
const OFFENTLIGE = ['ip', 'forslag', 'stats', 'top', 'online', 'link'];

const erStaff = m => m.roles.cache.some(r => STAFF.includes(r.id));
const TYPER = { support: ['Support', '🛟'], koeb: ['Køb', '💳'], ansoeg: ['Ansøgning', '📝'], fejl: ['Anmeldelse', '🚨'] };

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
    .setThumbnail(member.user.displayAvatarURL())] }).catch(() => {});
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
    if (i.isModalSubmit() && i.customId === 'devlog_modal') {
      const kanal = await client.channels.fetch(config.kanaler.devlog).catch(() => null);
      if (!kanal) return i.reply({ content: '#dev-log findes ikke.', flags: MessageFlags.Ephemeral });
      const punkter = i.fields.getTextInputValue('punkter').split('\n').map(x => x.trim()).filter(Boolean);
      await kanal.send({ embeds: [devlogEmbed(i.fields.getTextInputValue('titel'), punkter).setFooter({ text: `Skrevet af ${i.user.username}` })] });
      return i.reply({ content: `Dev-loggen er sendt i ${kanal}. 🛠️`, flags: MessageFlags.Ephemeral });
    }

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
      if (OFFENTLIGE.includes(i.commandName) && i.channelId !== config.kanaler.botcmd && !erStaff(i.member))
        return i.reply({ content: `Brug kommandoer i <#${config.kanaler.botcmd}> 🙂`, flags: MessageFlags.Ephemeral });
      if (i.commandName === 'link') {
        const l = linkAf(i.user.id);
        if (l) return i.reply({ content: `Du er allerede forbundet med **${l.n}**. Brug \`/unlink\` for at fjerne det.`, flags: MessageFlags.Ephemeral });
        for (const [k, v] of Object.entries(linkData.ventende)) if (v.d === i.user.id) delete linkData.ventende[k];
        const kode = nyLinkKode();
        linkData.ventende[kode] = { d: i.user.id, t: Date.now() }; gemLink();
        return i.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(LILLA)
          .setAuthor({ name: 'HOPDOP · Forbind din konto' })
          .setTitle('🔗 Din kode: ' + kode)
          .setDescription([
            `**1.** Join serveren: \`${SERVER_IP}\``,
            `**2.** Skriv i chatten: \`/discord ${kode}\``,
            '**3.** Inden for et minut får du din rank-rolle her og en besked fra mig.',
            '', '⏳ Koden virker i 30 minutter. Del den ikke med andre.',
          ].join('\n'))] });
      }
      if (i.commandName === 'unlink') {
        const l = linkAf(i.user.id);
        if (!l) return i.reply({ content: 'Du er ikke forbundet. Brug `/link` for at forbinde.', flags: MessageFlags.Ephemeral });
        delete linkData.links[i.user.id]; gemLink();
        postPrivat('link', { type: 'fjern', u: l.u }).catch(() => {});
        await synkRoller(i.guild, i.user.id, []);
        return i.reply({ content: `Forbindelsen til **${l.n}** er fjernet, og dine rank-roller er taget af.`, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'top' || i.commandName === 'online') {
        await i.deferReply();
        const emb = await (i.commandName === 'top' ? lavTopEmbed(i.options.getString('liste')) : lavOnlineEmbed())
          .catch(e => { console.error('Web-fejl:', e.message); return null; });
        return i.editReply(emb ? { embeds: [emb] } : 'Kunne ikke hente data lige nu. Prøv igen om lidt.');
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
        const msg = await kanal.send({
          embeds: [gwEmbed(g, 0)],
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('gw').setLabel('Deltag').setEmoji('🎉').setStyle(ButtonStyle.Primary))],
        });
        gwData[msg.id] = g;
        planlaegGiveaway(msg.id); gemGw();
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
      gemGw();
      const g = gwData[i.message.id];
      return i.message.edit({ embeds: [g ? gwEmbed(g, s.size) : i.message.embeds[0]] }).catch(() => {});
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
      const udskrift = await lavUdskrift(i.channel).catch(e => { console.error('Udskrift fejlede:', e.message); return null; });
      if (log) log.send({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('📁 Ticket lukket')
        .setDescription(`Kanal: **${i.channel.name}**\nEjer: <@${ejerId}>\nLukket af: ${i.user}${udskrift ? `\nBeskeder: **${udskrift.antal}**\n\nHele samtalen ligger i filen nedenfor.` : ''}`)],
        files: udskrift ? [udskrift.fil] : [] }).catch(() => {});
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
  } catch (e) {
    console.error('Fejl:', e);
    if (i.isRepliable() && !i.replied && !i.deferred) i.reply({ content: 'Der skete en fejl.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
