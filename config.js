module.exports = {
  SESSION_ID: process.env.SESSION_ID || "X-KING-u2oknAjC",
  AUTO_STATUS: process.env.AUTO_STATUS || true,          // Enable/disable status watching
  AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || true, // Auto-read status updates
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || false, // Auto-like status updates
  AUTO_LIKE_EMOJI: process.env.AUTO_LIKE_EMOJI || "✨"    // Emoji for auto-like
};