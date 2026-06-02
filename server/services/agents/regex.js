const STRIP_WORDS =
  /\b(tell|me|show|what|is|are|the|weather|forecast|temperature|temp|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|what's|latest|a|an|do|does|i|want|need|check|look|up|find|jarvis|hey|hi|hello|outside|like|its|it's|going|gonna|will|be|currently|right|now|today|this|week|weekend|tomorrow)\b/g;

function extractCity(msg) {
  const lower = msg.toLowerCase();
  
  // First try direct pattern match — most reliable
  const patterns = [
    /weather\s+(?:in|for|at)\s+([a-z][a-z\s]{1,25}?)(?:\?|$|today|now|this|,)/i,
    /(?:in|for|at)\s+([a-z][a-z\s]{1,25}?)\s+weather/i,
    /(?:in|for|at)\s+([a-z][a-z\s]{1,25}?)(?:\?|$|,)/i,
    /time\s+(?:in|for|at)\s+([a-z][a-z\s]{1,25}?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const m = lower.match(pattern);
    if (m?.[1]) {
      const city = m[1].trim().replace(/\s+/g, " ");
      if (city.length >= 2 && city.length <= 30) {
        return city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }
  }

  // Fallback: strip known words
  const city = lower
    .replace(STRIP_WORDS, " ")
    .replace(/[?.,!'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (city.length < 2 || city.length > 40) return null;
  return city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractNewsQuery(msg) {
  const m = msg.match(
    /(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/,
  );
  if (m) return m[1].trim();
  return (
    msg
      .replace(
        /\b(news|latest|headlines?|give|me|show|tell|about|get|the|what|is|are)\b/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function isFileSystemIntent(msg) {
  // Any of these signals = filesystem request
  const fsVerbs =
    /\b(open|find|search|look\s+for|show|list|browse|launch|where\s+is)\b/.test(
      msg,
    );
  const fsNouns =
    /\b(file|folder|document|directory|downloads|desktop|documents|pictures|music|videos|home)\b/.test(
      msg,
    );
  const hasExt = /\b[\w\s-]+\.[a-z0-9]{1,5}\b/.test(msg);
  const isUrl =
    /https?:\/\//.test(msg) ||
    /\w+\.(com|org|net|io|dev|co|app|ai|uk|edu)\b/.test(msg);

  return !isUrl && (fsNouns || (fsVerbs && hasExt) || (fsVerbs && fsNouns));
}

function isSystemControlIntent(msg) {
  return (
    // Core actions
    /\b(open|close|quit|exit|launch|start|switch|minimize|maximize|focus|sleep|lock|shutdown|restart|reboot|screenshot|capture|desktop|mission\s?control|app\s?switcher|mute|unmute|volume|brightness|type|write|input|press|hit|click|scroll|tab|window|app|application|browser|hide|force\s?quit|trash|recycle\s?bin|wifi|bluetooth|clipboard|copy|paste|zoom|record|screen\s?recording|microphone|battery|dark\s?mode|light\s?mode|keyboard\s?brightness)\b/i.test(
      msg,
    ) ||
    // Common app names
    /\b(chrome|safari|firefox|edge|spotify|itunes|music|vscode|visual\s?studio\s?code|terminal|finder|discord|slack|notion|figma|xcode|settings|system\s?settings|task\s?manager|activity\s?monitor)\b/i.test(
      msg,
    ) ||
    // Volume / brightness natural language
    /\b(louder|quieter|brighter|dimmer|turn\s?up\s?volume|turn\s?down\s?volume|increase\s?volume|decrease\s?volume|raise\s?brightness|lower\s?brightness)\b/i.test(
      msg,
    ) ||
    // Sleep / power variants
    /\b(power\s?off|turn\s?off|shut\s?down|put\s?(computer|mac|pc|laptop)\s?to\s?sleep|lock\s?(screen|computer|mac))\b/i.test(
      msg,
    ) ||
    // Screenshot variants
    /\b(take\s?a\s?screenshot|capture\s?(screen|display)|screen\s?capture)\b/i.test(
      msg,
    ) ||
    // Browser / tabs / windows
    /\b(new\s?tab|close\s?tab|new\s?window|close\s?window|switch\s?tab)\b/i.test(
      msg,
    ) ||
    // Media controls
    /\b(play\s?music|pause\s?music|next\s?song|previous\s?song|next\s?track|previous\s?track)\b/i.test(
      msg,
    ) ||
    // Search commands
    /\b(search\s?google|google\s?.*|youtube\s?search|search\s?youtube)\b/i.test(
      msg,
    ) ||
    // Connectivity
    /\b(turn\s?on\s?wifi|turn\s?off\s?wifi|wifi\s?on|wifi\s?off|bluetooth\s?on|bluetooth\s?off)\b/i.test(
      msg,
    ) ||
    // Clipboard commands
    /\b(copy\s?this|copy\s?text|paste\s?this|clear\s?clipboard)\b/i.test(msg) ||
    // UI appearance
    /\b(enable\s?dark\s?mode|disable\s?dark\s?mode|light\s?mode|dark\s?theme)\b/i.test(
      msg,
    ) ||
    // Screen recording
    /\b(record\s?screen|start\s?recording|stop\s?recording)\b/i.test(msg)
  );
}

module.exports = {
  extractCity,
  extractNewsQuery,
  isFileSystemIntent,
  isSystemControlIntent,
};
