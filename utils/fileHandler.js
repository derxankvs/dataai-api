const fs = require('fs');
const path = require('path');

module.exports = {
  listDataFiles: (dir) => {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  },
  readJson: (file) => {
    return JSON.parse(fs.readFileSync(file,'utf-8'));
  }
};
