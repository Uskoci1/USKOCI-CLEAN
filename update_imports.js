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
    if (text.includes('lazniIzvor')) {
        text = text.replace(/import\s+\{\s*lazniIzvor\s+as\s+izvor\s*\}\s+from\s+['"]\.\.\/\.\.\/data\/lazniIzvor['"];/g, "import { izvor } from '../../data';");
        text = text.replace(/import\s+\{\s*lazniIzvor\s+as\s+izvor\s*\}\s+from\s+['"]\.\.\/data\/lazniIzvor['"];/g, "import { izvor } from '../data';");
        fs.writeFileSync(f, text);
        console.log('Updated ' + f);
    }
});
