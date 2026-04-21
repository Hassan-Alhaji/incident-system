const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const mappings = {
  // Elevating Text readability globally
  'text-slate-500': 'text-slate-600',
  'text-slate-600': 'text-slate-700',
  'text-slate-700': 'text-slate-900', // Making standard text almost black
  'text-slate-800': 'text-slate-900', 
  
  // Clean up backgrounds
  'bg-slate-100': 'bg-white', // Make cards true white
  'bg-slate-50': 'bg-[#F8F9FA]', // Extremely soft off-white canvas
  'border-slate-300': 'border-[#E2E8F0]', // Soft clean borders
  'border-slate-400': 'border-[#CBD5E1]', 
  
  // Make borders soft but add shadow
  'rounded-xl': 'rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300',
};

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Special safeguard: We only want to add shadow-sm to generic cards, not if there are already shadows
    content = content.replace(/rounded-xl(?! shadow-)/g, 'rounded-xl shadow-sm transition-shadow duration-200');

    for (const [oldClass, newClass] of Object.entries(mappings)) {
        if(oldClass === 'rounded-xl') continue;
        
        // Match exact word boundaries
        const regex = new RegExp(`\\b${oldClass.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\b`, 'g');
        content = content.replace(regex, newClass);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Boosted Contrast: ${filePath}`);
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
