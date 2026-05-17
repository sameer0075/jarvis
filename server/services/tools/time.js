const NodeGeocoder = require("node-geocoder");

const geocoder = NodeGeocoder({
  provider: "openstreetmap",
});

async function getTime(city) {
  const res = await geocoder.geocode(city);

  if (!res.length) return `Unknown city: ${city}`;

  const { latitude, longitude } = res[0];
  const tz = require("tz-lookup")(latitude, longitude);

  return new Date().toLocaleString("en-US", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "medium",
  }) + ` (${tz})`;
}

module.exports = { getTime };