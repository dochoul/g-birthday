const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const size = 1024;

// 생일 케이크 아이콘 SVG (macOS 가이드라인에 맞게 약 10% 여백 추가)
const padding = 100; // 여백
const iconSize = size - (padding * 2); // 실제 아이콘 크기
const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Transparent background for padding -->
  <rect width="1024" height="1024" fill="transparent"/>
  
  <!-- Icon background with padding -->
  <rect x="${padding}" y="${padding}" width="${iconSize}" height="${iconSize}" rx="160" fill="#FF6B6B"/>
  
  <!-- All elements scaled and offset by padding -->
  <g transform="translate(${padding}, ${padding}) scale(${iconSize/1024})">
    <!-- Cake plate -->
    <ellipse cx="512" cy="780" rx="320" ry="40" fill="#E55555"/>
    
    <!-- Cake bottom layer -->
    <rect x="220" y="580" width="584" height="200" rx="20" fill="#FFF5E6"/>
    <rect x="220" y="580" width="584" height="200" rx="20" fill="url(#cakeGradient1)"/>
    
    <!-- Cake middle layer -->
    <rect x="260" y="420" width="504" height="180" rx="16" fill="#FFE4CC"/>
    <rect x="260" y="420" width="504" height="180" rx="16" fill="url(#cakeGradient2)"/>
    
    <!-- Cake top layer -->
    <rect x="300" y="280" width="424" height="160" rx="14" fill="#FFF0E0"/>
    <rect x="300" y="280" width="424" height="160" rx="14" fill="url(#cakeGradient3)"/>
    
    <!-- Frosting drips -->
    <path d="M300 280 Q320 320 300 340 L300 280" fill="#FFFFFF"/>
    <path d="M400 280 Q420 340 400 360 L400 280" fill="#FFFFFF"/>
    <path d="M500 280 Q530 330 510 350 L500 280" fill="#FFFFFF"/>
    <path d="M600 280 Q620 350 600 370 L600 280" fill="#FFFFFF"/>
    <path d="M700 280 Q720 320 700 340 L700 280" fill="#FFFFFF"/>
    
    <!-- Candles -->
    <rect x="380" y="160" width="24" height="120" rx="4" fill="#FFD93D"/>
    <rect x="500" y="140" width="24" height="140" rx="4" fill="#6BCB77"/>
    <rect x="620" y="160" width="24" height="120" rx="4" fill="#4D96FF"/>
    
    <!-- Flames -->
    <ellipse cx="392" cy="140" rx="18" ry="28" fill="#FF9F43"/>
    <ellipse cx="392" cy="135" rx="10" ry="18" fill="#FECA57"/>
    <ellipse cx="512" cy="120" rx="18" ry="28" fill="#FF9F43"/>
    <ellipse cx="512" cy="115" rx="10" ry="18" fill="#FECA57"/>
    <ellipse cx="632" cy="140" rx="18" ry="28" fill="#FF9F43"/>
    <ellipse cx="632" cy="135" rx="10" ry="18" fill="#FECA57"/>
    
    <!-- Decorations on cake -->
    <circle cx="350" cy="500" r="15" fill="#FF6B6B"/>
    <circle cx="450" cy="520" r="12" fill="#4D96FF"/>
    <circle cx="550" cy="490" r="14" fill="#6BCB77"/>
    <circle cx="650" cy="510" r="13" fill="#FFD93D"/>
    
    <circle cx="320" cy="650" r="18" fill="#4D96FF"/>
    <circle cx="430" cy="680" r="15" fill="#FF6B6B"/>
    <circle cx="550" cy="660" r="16" fill="#FFD93D"/>
    <circle cx="670" cy="670" r="14" fill="#6BCB77"/>
    <circle cx="750" cy="640" r="17" fill="#FF6B6B"/>
  </g>
  
  <defs>
    <linearGradient id="cakeGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF5E6;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#F5DEB3;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="cakeGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFE4CC;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#DEB887;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="cakeGradient3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF0E0;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#FFE4CC;stop-opacity:1"/>
    </linearGradient>
  </defs>
</svg>
`;

async function generateIcons() {
  const electronDir = path.join(__dirname, '../electron');
  const iconsetDir = path.join(electronDir, 'icon.iconset');
  
  // Create directories
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }
  
  // Generate PNG from SVG
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  // Save 1024x1024 base icon
  await sharp(pngBuffer)
    .resize(1024, 1024)
    .toFile(path.join(electronDir, 'icon.png'));
  
  console.log('Created icon.png');
  
  // Generate iconset for macOS
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const s of sizes) {
    await sharp(pngBuffer)
      .resize(s, s)
      .toFile(path.join(iconsetDir, `icon_${s}x${s}.png`));
    
    if (s <= 512) {
      await sharp(pngBuffer)
        .resize(s * 2, s * 2)
        .toFile(path.join(iconsetDir, `icon_${s}x${s}@2x.png`));
    }
  }
  
  console.log('Created iconset files');
  console.log('Run: iconutil -c icns electron/icon.iconset -o electron/icon.icns');
  
  // Generate ICO for Windows (256x256 PNG, will need conversion)
  await sharp(pngBuffer)
    .resize(256, 256)
    .toFile(path.join(electronDir, 'icon-256.png'));
  
  console.log('Created icon-256.png for Windows ICO conversion');
}

generateIcons().catch(console.error);
