require("dotenv").config();
const { createServer } = require("./app");

const PORT = process.env.PORT || 3001;
createServer().listen(PORT, () => {
  console.log(`\n✅ JARVIS ready on :${PORT}\n`);
});