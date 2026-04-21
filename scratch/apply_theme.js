const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'src');

// Collect all .tsx files recursively
function walk(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) results.push(full);
  }
  return results;
}

const SKIP = ['OCDashboard.tsx', 'OCLayout.tsx']; // Already updated

const replacements = [
  // Background colors
  ['bg-slate-950', 'bg-[#f0f2f5]'],
  ['bg-slate-900/80', 'bg-white'],
  ['bg-slate-900', 'bg-white'],
  ['bg-slate-800/80', 'bg-gray-50'],
  ['bg-slate-800', 'bg-gray-50'],
  ['bg-slate-700', 'bg-gray-100'],
  
  // Text colors - dark to new grays
  ['text-slate-900', 'text-gray-800'],
  ['text-slate-800', 'text-gray-700'],
  ['text-slate-700', 'text-gray-600'],
  ['text-slate-600', 'text-gray-500'],
  ['text-slate-500', 'text-gray-400'],
  ['text-slate-400', 'text-gray-400'],  
  ['text-slate-300', 'text-gray-500'],
  ['text-slate-200', 'text-gray-600'],
  ['text-white', 'text-gray-800'],
  
  // Borders
  ['border-slate-800', 'border-gray-200'],
  ['border-slate-700/50', 'border-gray-100'],
  ['border-slate-700', 'border-gray-200'],
  ['border-slate-600', 'border-gray-300'],
  ['border-[#CBD5E1]', 'border-gray-200'],
  ['border-[#E2E8F0]', 'border-gray-100'],
  
  // Placeholders
  ['placeholder-slate-500', 'placeholder-gray-400'],
  ['placeholder-slate-600', 'placeholder-gray-400'],
  
  // Hover/focus states
  ['hover:text-white', 'hover:text-blue-600'],
  ['hover:bg-slate-700', 'hover:bg-gray-100'],
  ['hover:bg-slate-800', 'hover:bg-gray-50'],
  ['hover:border-slate-600', 'hover:border-gray-300'],
  
  // Rings/Focus
  ['focus:ring-emerald-500', 'focus:ring-blue-400'],
  ['focus:ring-blue-600/30', 'focus:ring-blue-500/20'],
  ['focus:border-blue-600/50', 'focus:border-blue-400'],
  
  // Shadows
  ['shadow-xl', 'shadow-md'],
  ['shadow-sm transition-shadow duration-200', 'shadow-sm'],
  
  // Specific component patterns
  ['bg-[#F8F9FA]', 'bg-[#f0f2f5]'],
  
  // Fix text-white that was incorrectly changed in buttons/badges (restore where needed)
];

// Contextual replacements - only replace text-white when it's NOT inside a colored button/badge context
const contextSkipPatterns = [
  'bg-blue-600',
  'bg-red-500',
  'bg-emerald-500',
  'bg-emerald-600',
  'bg-green-600',
  'bg-gradient-to',
  'bg-blue-500',
  'text-white px-',
  'text-white font-bold',
];

let totalChanges = 0;
const files = walk(SRC);

for (const file of files) {
  const basename = path.basename(file);
  if (SKIP.includes(basename)) continue;
  if (basename.endsWith('.test.tsx')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [from, to] of replacements) {
    // Special handling for text-white: skip if it's inside a colored button context
    if (from === 'text-white') {
      const lines = content.split('\n');
      const newLines = lines.map(line => {
        if (!line.includes('text-white')) return line;
        // Check if this line has a colored background that justifies white text
        const hasColoredBg = contextSkipPatterns.some(p => line.includes(p));
        if (hasColoredBg) return line;
        return line.replace(/text-white/g, to);
      });
      content = newLines.join('\n');
    } else {
      content = content.split(from).join(to);
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    totalChanges++;
    console.log(`✅ Updated: ${basename}`);
  }
}

console.log(`\nTotal files updated: ${totalChanges}`);
