const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

exports.default = async function (context) {
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const plistPath = path.join(appPath, 'Contents', 'Info.plist')
  const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar')

  if (!fs.existsSync(asarPath) || !fs.existsSync(plistPath)) return

  // Compute correct SHA256 hash
  const asarData = fs.readFileSync(asarPath)
  const correctHash = crypto.createHash('sha256').update(asarData).digest('hex')

  // Read plist and replace hash
  let plist = fs.readFileSync(plistPath, 'utf-8')
  const hashRegex = /(<key>hash<\/key>\s*<string>)[a-f0-9]{64}(<\/string>)/
  if (hashRegex.test(plist)) {
    plist = plist.replace(hashRegex, `$1${correctHash}$2`)
    fs.writeFileSync(plistPath, plist)
    console.log(`  • fixed ASAR integrity hash → ${correctHash}`)
  }
}
