const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

const processFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Regex to find and remove any className part starting with dark:
    // This looks for "dark:" followed by letters, dashes, brackets, slashes, numbers until a space, quote, or backtick.
    const darkClassRegex = /\s*dark:[a-zA-Z0-9\-\/\[\]#]+/g;
    
    content = content.replace(darkClassRegex, '');

    // Cleanup double spaces created by the removal
    content = content.replace(/className=(["`']) +/g, 'className=$1');
    content = content.replace(/  +/g, ' ');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Stripped Dark Mode from: ${filePath}`);
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
console.log('Complete');
