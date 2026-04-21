const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const mappings = {
  // Convert Primary Amber actions to Corporate Blue
  'bg-amber-500': 'bg-blue-600',
  'hover:bg-amber-600': 'hover:bg-blue-700',
  'text-amber-500': 'text-blue-600',
  'text-amber-400': 'text-blue-500',
  'border-amber-500': 'border-blue-600',

  // Convert Gradients
  'from-amber-500': 'from-blue-600',
  'to-orange-600': 'to-blue-800',
  'ring-amber-500': 'ring-blue-600',
  
  // Replace slate-50/100 gradients with pure clean backgrounds where possible
  // We'll leave structural gradients alone but they are already from-slate-50
  
  // Fix ticket statuses generic colors if any were hardcoded (we will fix OCDashboard)
};

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    for (const [oldClass, newClass] of Object.entries(mappings)) {
        const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
        content = content.replace(regex, newClass);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Converted to Corporate Theme: ${filePath}`);
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
