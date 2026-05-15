const fs = require('fs');
const path = 'c:/Users/al3re/.gemini/antigravity/scratch/Incident_System/frontend/src/components/TicketSections.tsx';

// CP1252 special chars (0x80-0x9F) mapped to Unicode
const cp1252ToUnicode = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};

// Build reverse map: Unicode codepoint -> CP1252 byte
const unicodeToCp1252 = {};
for (const [byte, unicode] of Object.entries(cp1252ToUnicode)) {
  unicodeToCp1252[unicode] = parseInt(byte);
}

let text = fs.readFileSync(path, 'utf8');

// Convert each char back to its CP1252 byte value
const bytes = [];
for (let i = 0; i < text.length; i++) {
  const code = text.charCodeAt(i);
  if (code < 0x80) {
    bytes.push(code);
  } else if (code <= 0xFF) {
    // Direct Latin-1 range (A0-FF maps 1:1)
    bytes.push(code);
  } else if (unicodeToCp1252[code] !== undefined) {
    // This is a CP1252 special char
    bytes.push(unicodeToCp1252[code]);
  } else {
    // High Unicode char not in CP1252 - encode as UTF-8
    // This shouldn't happen in properly mojibaked text, but handle it
    const s = String.fromCharCode(code);
    const b = Buffer.from(s, 'utf8');
    for (let j = 0; j < b.length; j++) bytes.push(b[j]);
  }
}

const fixed = Buffer.from(bytes).toString('utf8');

// Verify
const sample = fixed.indexOf('Approved');
if (sample > -1) {
  console.log('Around Approved:', JSON.stringify(fixed.substring(sample - 5, sample + 15)));
}

const hasCheck = fixed.includes('✓');
const hasCross = fixed.includes('✗');
const hasWarning = fixed.includes('⚠');
const hasArabic = fixed.includes('مفعتمدة') || fixed.includes('اعتماد');
console.log('✓ present:', hasCheck);
console.log('✗ present:', hasCross);  
console.log('⚠ present:', hasWarning);
console.log('Arabic present:', hasArabic);

const hasBroken = fixed.includes('âœ') || fixed.includes('Ø§Ù');
console.log('Broken chars:', hasBroken);

if (!hasBroken && hasCheck) {
  fs.writeFileSync(path, fixed, 'utf8');
  console.log('SUCCESS! File saved.');
} else {
  console.log('Not saving - check output above.');
}
