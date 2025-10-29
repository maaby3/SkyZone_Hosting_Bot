import 'dotenv/config'
import { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } from 'discord.js'
import fetch from 'node-fetch'

const {
  DISCORD_TOKEN, GUILD_ID, VERIFY_ROLE_ID, STAFF_ROLE_ID, ANNOUNCE_CHANNEL_ID, TICKET_CATEGORY_ID, STAFF_WEBHOOK_URL,
  API_BASE_URL = 'http://localhost:8080'
} = process.env
if(!DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN')

const client = new Client({ intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials:[Partials.GuildMember, Partials.Channel, Partials.Message] })

client.once('ready', async () => {
  console.log('Bot ready:', client.user.tag)
  client.user.setPresence({ activities:[{ name:'SkyZone Hosting • /panel'}], status:'online' })
  const cmds = [
    { name:'panel', description:'שליחת פנאל הזמנה/טיקט/אימות' },
    { name:'announce', description:'שליחת הודעת הכרזה', options:[{name:'text',description:'טקסט',type:3,required:true}] }
  ]
  await client.application.commands.set(cmds, GUILD_ID || null)
})

client.on('interactionCreate', async (i)=>{
  if (i.isChatInputCommand()){
    if (i.commandName==='panel'){
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_order').setLabel('🧾 פתיחת הזמנה').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('open_ticket').setLabel('🎫 טיקט תמיכה').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('verify_me').setLabel('✅ אימות').setStyle(ButtonStyle.Secondary),
      )
      const em = new EmbedBuilder().setColor(0x1f6feb).setTitle('SkyZone Hosting — פנאל שירות').setDescription('פתח הזמנה, טיקט תמיכה או אימות.')
      return i.reply({ embeds:[em], components:[row] })
    }
    if (i.commandName==='announce'){
      if (!i.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) return i.reply({content:'אין הרשאה', ephemeral:true})
      const ch = ANNOUNCE_CHANNEL_ID ? await i.client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(()=>null) : null
      if (!ch) return i.reply({content:'ANNOUNCE_CHANNEL_ID לא מוגדר/לא נמצא', ephemeral:true})
      await ch.send({ content: i.options.getString('text') })
      return i.reply({ content:'נשלח ✅', ephemeral:true })
    }
  }
  if (i.isButton()){
    if (i.customId==='verify_me'){
      if (!VERIFY_ROLE_ID) return i.reply({ content:'VERIFY_ROLE_ID לא מוגדר', ephemeral:true })
      await i.member.roles.add(VERIFY_ROLE_ID).catch(()=>{})
      return i.reply({ content:'אומתת ✅', ephemeral:true })
    }
    if (i.customId==='open_ticket'){
      if (!TICKET_CATEGORY_ID || !STAFF_ROLE_ID) return i.reply({content:'הגדר TICKET_CATEGORY_ID/STAFF_ROLE_ID', ephemeral:true})
      const cat = await i.client.channels.fetch(TICKET_CATEGORY_ID)
      const ch = await i.guild.channels.create({
        name:`ticket-${i.user.username}`.toLowerCase(), type: ChannelType.GuildText, parent: cat.id,
        permissionOverwrites:[
          { id:i.guild.roles.everyone, deny:[PermissionsBitField.Flags.ViewChannel] },
          { id:i.user.id, allow:[PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id:STAFF_ROLE_ID, allow:[PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ]
      })
      const em = new EmbedBuilder().setColor(0x22bb33).setTitle('טיקט נפתח').setDescription('צוות ישיב בקרוב.')
      await ch.send({ content:`<@&${STAFF_ROLE_ID}>`, embeds:[em] })
      return i.reply({ content:`נפתח טיקט: ${ch}`, ephemeral:true })
    }
    if (i.customId==='open_order'){
      const modal = new ModalBuilder().setCustomId('order_modal').setTitle('פתיחת הזמנה')
      const nm = new TextInputBuilder().setCustomId('full_name').setLabel('שם מלא').setStyle(TextInputStyle.Short).setRequired(true)
      const em = new TextInputBuilder().setCustomId('email').setLabel('אימייל').setStyle(TextInputStyle.Short).setRequired(true)
      const pl = new TextInputBuilder().setCustomId('plan').setLabel('חבילה (basic/pro/vip)').setStyle(TextInputStyle.Short).setRequired(true)
      const r1 = new ActionRowBuilder().addComponents(nm), r2 = new ActionRowBuilder().addComponents(em), r3 = new ActionRowBuilder().addComponents(pl)
      modal.addComponents(r1,r2,r3)
      return i.showModal(modal)
    }
  }
  if (i.isModalSubmit() && i.customId==='order_modal'){
    const fullName = i.fields.getTextInputValue('full_name')
    const email = i.fields.getTextInputValue('email')
    const plan = i.fields.getTextInputValue('plan').toLowerCase().trim()
    try{
      const r = await fetch(`${API_BASE_URL}/api/order`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fullName, email, plan }) })
      const j = await r.json()
      if (j.ok){
        await i.reply({ content:`נקלט! מס׳ הזמנה: ${j.order.id}`, ephemeral:true })
      }else{
        await i.reply({ content:`שגיאה: ${j.error}`, ephemeral:true })
      }
    }catch(e){
      await i.reply({ content:'שגיאת חיבור ל־API', ephemeral:true })
    }
  }
})

client.login(DISCORD_TOKEN)
