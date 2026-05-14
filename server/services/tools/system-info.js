const si = require("systeminformation");
async function getSystemStats() {
  const cpu = await si.currentLoad();
  const mem = await si.mem();
  const network = await si.networkStats();

  return {
    cpu: Math.round(cpu.currentLoad),
    ram: Math.round(
      ((mem.total - mem.available) / mem.total) * 100
    ),
    net: Math.round(network[0]?.rx_sec / 1024 || 0),
  };
}

module.exports = { getSystemStats }