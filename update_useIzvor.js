const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx')) results.push(file);
        }
    });
    return results;
}

const files = walk('src/app');
files.forEach(f => {
    let text = fs.readFileSync(f, 'utf8');
    if (text.includes('import { izvor }')) {
        const depth = f.split('/').length - 2;
        let relativePath = '';
        for (let i = 0; i < depth; i++) relativePath += '../';
        
        text = text.replace(/import\s+\{\s*izvor\s*\}\s+from\s+['"]\.\.\/data['"];/g, "import { useIzvor } from '" + relativePath + "store/uloga';");
        text = text.replace(/import\s+\{\s*izvor\s*\}\s+from\s+['"]\.\.\/\.\.\/data['"];/g, "import { useIzvor } from '" + relativePath + "store/uloga';");
        
        // Find the component function to inject const izvor = useIzvor();
        text = text.replace(/(export default function [a-zA-Z0-9_]+\([^)]*\)\s*\{)/g, "\\n  const izvor = useIzvor();");
        
        fs.writeFileSync(f, text);
        console.log('Updated ' + f);
    }
});
