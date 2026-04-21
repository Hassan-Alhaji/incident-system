const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const mappings = {
  // Darken texts for Light Theme
  'text-slate-600': 'text-slate-800',
  'text-slate-500': 'text-slate-700',
  'text-slate-700': 'text-slate-900',
  
  // Darken borders for Light Theme
  'border-slate-200': 'border-slate-300',
  'border-slate-300': 'border-slate-400',

  // Slightly darken box backgrounds from slate-50 to slate-100
  'bg-slate-50': 'bg-slate-100',
  
  // Bump text sizes generally from xs to sm, sm to base
  'text-xs': 'text-sm',
  'text-sm': 'text-base',
  'text-[10px]': 'text-xs',
  'text-[11px]': 'text-sm',
  
  // Adjust icon sizes if they were smaller
  'size={14}': 'size={16}',
  'size={12}': 'size={14}',
};

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    for (const [oldClass, newClass] of Object.entries(mappings)) {
        // Safe regex to ensure we grab full word
        const regex = new RegExp(`(?<!dark:)\\b${oldClass.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\b`, 'g');
        content = content.replace(regex, newClass);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Enhanced Contrast & Size: ${filePath}`);
    }
};

const walkSync = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkSync(filePath);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            processFile(filePath);
        }
    }
};

walkSync(srcDir);
