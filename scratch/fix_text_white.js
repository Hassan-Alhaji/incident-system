const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // We want to replace "text-white" with "text-slate-900 dark:text-white"
    // BUT only if NOT preceded by "bg-blue", "bg-emerald", "bg-red", "bg-amber", "bg-orange", "bg-cyan", "bg-indigo", "from-", "via-", "to-" in the same class string.
    
    // An easier regex: match the whole className="..." and replace "text-white" only when it doesn't contain solid bg colors
    content = content.replace(/className=(["'{][^"'{}]*["'}])/g, (match, classStr) => {
        if (!classStr.includes('text-white')) return match;
        
        const hasSolidBg = /bg-(amber|red|blue|emerald|teal|cyan|indigo|orange|purple)-[4567]00/.test(classStr);
        const hasGradient = /(from-|to-|via-)(amber|red|blue|emerald|teal|cyan|indigo|orange|purple)/.test(classStr);
        
        if (!hasSolidBg && !hasGradient) {
            // Safe to replace
            return match.replace(/text-white(?! dark:text-white)/g, 'text-slate-900 dark:text-white');
        }
        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated text-white: ${filePath}`);
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
