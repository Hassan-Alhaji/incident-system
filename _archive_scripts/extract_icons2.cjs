const fs = require('fs');

const extractBetween = (str, start, end) => {
    const startIndex = str.indexOf(start);
    if (startIndex === -1) return '';
    const endIndex = str.indexOf(end, startIndex + start.length);
    if (endIndex === -1) return '';
    return str.substring(startIndex, endIndex + end.length);
};

const replaceInFile = (filePath, isComponentsFolder) => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add import statement
    const importPath = isComponentsFolder ? "./HazardIcons" : "../components/HazardIcons";
    if (!content.includes('import { HAZARD_CATEGORIES, HazardIcon }')) {
        content = "import { HAZARD_CATEGORIES, HazardIcon } from '" + importPath + "';\n" + content;
    }

    if (filePath.includes('TicketDetail.tsx')) {
        const toReplace = extractBetween(content, "[", "].map(cat => {");
        if (toReplace && toReplace.includes('Psychosocial Hazards')) {
            content = content.replace(toReplace, 'HAZARD_CATEGORIES.map(cat => {\n                                                let catIcon = <HazardIcon category={cat.value} className="w-9 h-9" />;');
            content = content.replace(/\{cat\.icon\}/g, '{catIcon}');
        }
    } else if (filePath.includes('TicketSections.tsx')) {
        const toReplace = extractBetween(content, "[", "].map(cat => {");
        if (toReplace && toReplace.includes('Psychosocial Hazards')) {
            content = content.replace(toReplace, 'HAZARD_CATEGORIES.map(cat => {\n                                    let catIcon = <HazardIcon category={cat.value} className="w-9 h-9" />;');
            content = content.replace(/\{cat\.icon\}/g, '{catIcon}');
        }
    } else if (filePath.includes('TicketPrintReport.tsx')) {
        const toReplace = extractBetween(content, "const categoryConfig: Record<string, { label: string, labelAr: string, svg: JSX.Element }> = {", "};");
        if (toReplace && toReplace.includes('Psychosocial Hazards')) {
            const newConfig = "const categoryConfig = HAZARD_CATEGORIES.reduce((acc, cat) => {\n" +
                "            acc[cat.value] = { label: cat.labelEn, labelAr: cat.labelAr, svg: <HazardIcon category={cat.value} className=\"w-12 h-12\" /> };\n" +
                "            return acc;\n" +
                "        }, {} as Record<string, any>);";
            content = content.replace(toReplace, newConfig);
        }
    }

    fs.writeFileSync(filePath, content);
};

replaceInFile('frontend/src/pages/TicketDetail.tsx', false);
replaceInFile('frontend/src/components/TicketSections.tsx', true);
replaceInFile('frontend/src/components/TicketPrintReport.tsx', true);

console.log('Hazard icons extracted and files updated.');
