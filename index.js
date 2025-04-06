const { Boom } = require('@hapi/boom');
const { default: makeWASocket, Browsers, useMultiFileAuthState, makeInMemoryStore, jidNormalizedUser } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const got = require('got');
const config = require('./config');
// Configuration
const sessionFolder = path.join(__dirname, './session');
const sessionFile = path.join(sessionFolder, 'creds.json');

// Store for messages
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

// Function to download session from config
async function createSessionFromConfig() {
  if (config.SESSION_ID && config.SESSION_ID.startsWith("X-KING-")) {
    const fileId = config.SESSION_ID.replace("X-KING-", "");
    const url = `https://king-api-437z.onrender.com/upload/${fileId}`;
    try {
      const response = await got(url, { responseType: "json" });
      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true });
      }
      fs.writeFileSync(sessionFile, JSON.stringify(response.body, null, 2));
      console.log("✅ Session restored from X-KING-FILEID.");
      return true;
    } catch (error) {
      console.error("❌ Failed to fetch session:", error.message);
      return false;
    }
  }
  return false;
}

// Function to mark status as read
async function markStatusAsRead(client, message) {
  try {
    if (message.key) {
      await client.readMessages([message.key]);
      console.log("✅ Status marked as read");
    }
  } catch (error) {
    console.error("❌ Error marking status as read:", error);
  }
}

// Function to react to status
async function reactToStatus(client, message, emoji = "✨") {
  try {
    if (message.key.remoteJid && message.key.participant) {
      const botJid = jidNormalizedUser(client.user.id);
      await client.sendMessage(
        message.key.remoteJid,
        {
          react: {
            key: message.key,
            text: emoji,
          },
        },
        {
          statusJidList: [message.key.participant, botJid],
        }
      );
      console.log(`✅ Reacted to status with ${emoji}`);
    }
  } catch (error) {
    console.error("❌ Error reacting to status:", error);
  }
}

// Main function to start the bot
async function startBot() {
  // Try to restore session from config if available
  await createSessionFromConfig();

  // Load auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  // Create WhatsApp client
  const client = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    getMessage: async (key) => {
      return {
        conversation: 'Hello World'
      }
    }
  });

  // Bind store to client
  store.bind(client.ev);

  // Save credentials when updated
  client.ev.on('creds.update', saveCreds);

  // Process messages
  client.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      // Log all messages
      console.log('📩 New message:', {
        from: message.key.remoteJid,
        message: message.message?.conversation || JSON.stringify(message.message),
        type: message.key.fromMe ? 'Outgoing' : 'Incoming'
      });

      // Check for status messages
      if (message.key.remoteJid && message.key.remoteJid.endsWith('status@broadcast')) {
        console.log('📢 Status message:', {
          sender: message.pushName,
          content: message.message?.conversation || 'Media status'
        });

        // Mark status as read
        await markStatusAsRead(client, message);

        // Optional: React to status
        // await reactToStatus(client, message);
      }
    }
  });

  // Handle connection updates
  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== 401;
      console.log(`Connection closed due to ${lastDisconnect.error} reconnecting ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });


}

// Start the bot
startBot().catch(err => console.error('❌ Bot startup error:', err));