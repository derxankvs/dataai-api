const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname,'..','data');
router.get('/data-files.json', (req,res)=>{
  try{
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'consultas.json');
    res.json(files);
  }catch(e){ res.json([]); }
});
module.exports = router;
