const si = require("systeminformation");

async function getSystemStats() {
  const [cpu, mem, network, disk, temp, processes, battery] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.networkStats(),
    si.fsSize(),
    si.cpuTemperature().catch(() => ({ main: null })),
    si.processes(),
    si.battery().catch(() => ({ hasBattery: false })),
  ]);

  // Main disk (largest or first)
  const mainDisk = disk.sort((a, b) => b.size - a.size)[0] || {};

  return {
    cpu:      Math.round(cpu.currentLoad),
    cpuCores: cpu.cpus?.map((c, i) => ({ core: i, load: Math.round(c.load) })) || [],
    ram:      Math.round(((mem.total - mem.available) / mem.total) * 100),
    ramUsed:  Math.round(mem.used / 1024 / 1024 / 1024 * 10) / 10,   // GB
    ramTotal: Math.round(mem.total / 1024 / 1024 / 1024 * 10) / 10,  // GB
    swap:     mem.swaptotal > 0 ? Math.round((mem.swapused / mem.swaptotal) * 100) : 0,
    net:      Math.round((network[0]?.rx_sec || 0) / 1024),           // KB/s
    netTx:    Math.round((network[0]?.tx_sec || 0) / 1024),           // KB/s
    disk:     mainDisk.size ? Math.round((mainDisk.used / mainDisk.size) * 100) : 0,
    diskUsed: mainDisk.used  ? Math.round(mainDisk.used  / 1024 / 1024 / 1024) : 0, // GB
    diskSize: mainDisk.size  ? Math.round(mainDisk.size  / 1024 / 1024 / 1024) : 0, // GB
    temp:     temp.main ? Math.round(temp.main) : null,
    processes: processes.all || 0,
    battery:  battery.hasBattery ? {
      percent:   battery.percent,
      charging:  battery.isCharging,
      remaining: battery.timeRemaining,
    } : null,
  };
}

module.exports = { getSystemStats };