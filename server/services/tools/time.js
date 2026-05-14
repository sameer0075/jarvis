const TIMEZONE_MAP = {
  tokyo: "Asia/Tokyo",
  london: "Europe/London",
  paris: "Europe/Paris",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  dubai: "Asia/Dubai",
  sydney: "Australia/Sydney",
  berlin: "Europe/Berlin",
  singapore: "Asia/Singapore",
  chicago: "America/Chicago",
  moscow: "Europe/Moscow",
  beijing: "Asia/Shanghai",
  mumbai: "Asia/Kolkata",
  karachi: "Asia/Karachi",
  istanbul: "Europe/Istanbul",
  toronto: "America/Toronto",
  lahore: "Asia/Karachi",
  delhi: "Asia/Kolkata",
  dhaka: "Asia/Dhaka",
};

function getTime(city) {
  const key = city.toLowerCase();
  const tz = Object.entries(TIMEZONE_MAP).find(([k]) => key.includes(k))?.[1];
  if (!tz) return `Unknown city: "${city}"`;
  return (
    new Date().toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "medium" }) +
    ` (${tz})`
  );
}

module.exports = { getTime };