const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const mappings = {
  'bg-slate-900': 'bg-slate-50 dark:bg-slate-900',
  'bg-slate-800': 'bg-white dark:bg-slate-800',
  'bg-slate-700': 'bg-slate-200 dark:bg-slate-700',
  'text-slate-300': 'text-slate-700 dark:text-slate-300',
  'text-slate-400': 'text-slate-600 dark:text-slate-400',
  'border-slate-700': 'border-slate-300 dark:border-slate-700',
  'border-slate-800': 'border-slate-200 dark:border-slate-800',
  'from-slate-900': 'from-slate-50 dark:from-slate-900',
  'to-slate-800': 'to-white dark:to-slate-800',
  // Careful with text-white as it conflicts sometimes, standardizing it
};

// Prevent doubling if script is run twice
const safeReplace = (content, oldClass, newClass) => {
    // Only replace if the oldClass isn't immediately preceded by "dark:" or already part of the double combo
    const regex = new RegExp(`(?<!dark:)\\b${oldClass}(?!\\s*dark:${oldClass})\\b`, 'g');
    return content.replace(regex, newClass);
};

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Special fix for text-white outside of colored buttons. We can't safely regex text-white universally 
    // because buttons like "bg-amber-500 text-white" should stay white.
    // Instead we handle structural slate borders.

    for (const [oldClass, newClass] of Object.entries(mappings)) {
        content = safeReplace(content, oldClass, newClass);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated: ${filePath}`);
    }
};

const walkSync = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkSync(filePath);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            processFile(filePath);
        }
    }
};

console.log('Starting theme shift...');
walkSync(srcDir);
console.log('Theme shift complete!');
