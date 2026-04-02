const fs = require('fs');
const path = require('path');

async function main() {
  const pngToIco = (await import('png-to-ico')).default;
  
  const pngPath = path.join(__dirname, '../electron/icon.png');
  const icoPath = path.join(__dirname, '../electron/icon.ico');

  const buf = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, buf);
  console.log('Created icon.ico with 256x256 support');
}

main().catch(console.error);
