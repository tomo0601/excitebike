const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/this\.this\.keysJustPressed/g, 'this.keysJustPressed');

// Restore keysJustPressed outside Player class
c = c.replace('this.keysJustPressed.ArrowUp = false; this.keysJustPressed.ArrowDown = false;', 'keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;');
c = c.replace('this.keysJustPressed.ArrowUp = false; this.keysJustPressed.ArrowDown = false;', 'keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;');
c = c.replace('if (!keys[code] && this.keysJustPressed.hasOwnProperty(code)) this.keysJustPressed[code] = true;', 'if (!keys[code] && keysJustPressed.hasOwnProperty(code)) keysJustPressed[code] = true;');
c = c.replace('if (this.keysJustPressed.hasOwnProperty(code)) this.keysJustPressed[code] = true;', 'if (keysJustPressed.hasOwnProperty(code)) keysJustPressed[code] = true;');

fs.writeFileSync(file, c);
console.log('Fixed syntax errors');
