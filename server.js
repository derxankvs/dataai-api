// server.js - DataAI v3
const express = require('express');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const axios = require('axios');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Criar diretórios necessários
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, 'backups'))) fs.mkdirSync(path.join(DATA_DIR, 'backups'));
if (!fs.existsSync(path.join(DATA_DIR, 'consultas.json'))) fs.writeFileSync(path.join(DATA_DIR, 'consultas.json'), '[]');
if (!fs.existsSync(path.join(DATA_DIR, 'pagamentos.json'))) fs.writeFileSync(path.join(DATA_DIR, 'pagamentos.json'), '[]');

const config = require('./config.json');

// Middlewares
app.use(helmet());
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rate limiter
const limiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120 });
app.use(limiter);

// Função auxiliar
function safeFilename(name) {
  return name.replace(/[^a-z0-9_.-]/gi, '_');
}

// 1️⃣ Armazenar dados JSON
app.post('/a/key=:key/json', (req, res) => {
  try {
    const key = safeFilename(req.params.key);

    // pegar usuário logado
    const user = req.body.user || 'guest'; // você pode enviar no corpo o user

    // pasta do usuário
    const userDir = path.join(DATA_DIR, safeFilename(user));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    const file = path.join(userDir, key + '.json');
    const payload = req.body.data || req.body; // JSON real enviado no body

    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');

    const baseUrl = req.protocol + '://' + req.get('host');
    return res.json({
      success: true,
      message: 'Arquivo salvo na pasta do usuário!',
      file: `/a/key=${key}/json`,
      view: `${baseUrl}/a/key=${key}/json/view?user=${user}`,
      download: `${baseUrl}/a/key=${key}/json/download?user=${user}`
    });
  } catch (e) {
    return res.status(500).json({ success:false, error: e.message });
  }
});

app.get('/a/key=:key/json/view', (req,res)=>{
  const key = safeFilename(req.params.key);
  const user = req.query.user || 'guest';
  const file = path.join(DATA_DIR, safeFilename(user), key+'.json');
  if(!fs.existsSync(file)) return res.status(404).json({success:false,message:'Arquivo não encontrado'});
  res.sendFile(file);
});

app.get('/a/key=:key/json/download', (req,res)=>{
  const key = safeFilename(req.params.key);
  const user = req.query.user || 'guest';
  const file = path.join(DATA_DIR, safeFilename(user), key+'.json');
  if(!fs.existsSync(file)) return res.status(404).json({success:false,message:'Arquivo não encontrado'});
  res.download(file, key+'.json');
});

app.get('/a/key=:key/json/download', (req, res) => {
  const key = safeFilename(req.params.key);
  const file = path.join(DATA_DIR, key + '.json');
  if (!fs.existsSync(file)) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
  res.download(file, key + '.json');
});

// 2️⃣ Consultas públicas
app.get('/:tipo/:dado/json', async (req, res) => {
  const tipo = req.params.tipo.toLowerCase();
  const dado = req.params.dado;
  try {
    let url = null;

    switch (tipo) {
      case 'cep': url = `https://viacep.com.br/ws/${dado}/json/`; break;
      case 'cnpj': url = `https://publica.cnpj.ws/cnpj/${dado}`; break;
      case 'ip': url = `https://ipapi.co/${dado}/json/`; break;
      case 'dominio': case 'domain': url = `https://api.domainsdb.info/v1/domains/search?domain=${dado}`; break;
      case 'bin': url = `https://lookup.binlist.net/${dado}`; break;
      case 'ddd': url = `https://brasilapi.com.br/api/ddd/v1/${dado}`; break;
      case 'placa': url = `https://brasilapi.com.br/api/fipe/preco/v1/${dado}`; break;
      case 'cpf': url = `https://api.invertexto.com/v1/validator?value=${dado}&type=cpf`; break;
      case 'nome': url = `https://api.agify.io/?name=${dado}`; break;
      case 'clima': url = `https://wttr.in/${dado}?format=j1`; break;
      case 'btc': case 'bitcoin': url = `https://api.coindesk.com/v1/bpi/currentprice/BRL.json`; break;
      case 'pokemon': url = `https://pokeapi.co/api/v2/pokemon/${dado}`; break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de consulta não suportado. Use: cep, cnpj, ip, dominio, bin, ddd, placa, cpf, nome, clima, pokemon, bitcoin'
        });
    }

    const r = await axios.get(url);
    return res.json({ success: true, origem: tipo, data: r.data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// 5) Gerar key para usuários
app.post('/gerar-key', (req, res) => {
  try {
    const USERS_FILE = path.join(DATA_DIR, 'users.json');
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf-8');

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const nome = req.body.nome || 'Usuário';
    const id = uuidv4().split('-')[0];
    const key = `dataai_${id}`;

    // verifica se a key já existe (pouco provável)
    if (users.find(u => u.key === key)) {
      return res.status(409).json({ success: false, message: 'Erro ao gerar key, tente novamente.' });
    }

    const novoUsuario = {
      id: uuidv4(),
      nome,
      key,
      criado_em: new Date().toISOString()
    };

    users.push(novoUsuario);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

    const baseUrl = req.protocol + '://' + req.get('host');

    return res.json({
      success: true,
      message: 'Key gerada com sucesso',
      usuario: novoUsuario,
      exemplos: {
        armazenar: `${baseUrl}/a/key=${key}/json`,
        visualizar: `${baseUrl}/a/key=${key}/json/view`,
        download: `${baseUrl}/a/key=${key}/json/download`
      }
    });

  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});


// 4️⃣ Armazenar consultas
app.post('/a/consultas/json', (req, res) => {
  try {
    const consultasFile = path.join(DATA_DIR, 'consultas.json');
    let arr = JSON.parse(fs.readFileSync(consultasFile, 'utf-8') || '[]');
    const item = { id: uuidv4(), timestamp: new Date().toISOString(), data: req.body };
    arr.unshift(item);
    fs.writeFileSync(consultasFile, JSON.stringify(arr, null, 2), 'utf-8');
    return res.json({ success: true, item });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/a/consultas/json/view', (req, res) => {
  res.sendFile(path.join(DATA_DIR, 'consultas.json'));
});

app.get('/a/consultas/json/download', (req, res) => {
  res.download(path.join(DATA_DIR, 'consultas.json'), 'consultas.json');
});

// 3️⃣ Pagamentos InfinitePay
app.post('/pagar', async (req, res) => {
  try {
    const { amount, items, customer, address, order_nsu, redirect_url, webhook_url } = req.body;
    const handle = config.infinitepay_handle;

    if (!handle) {
      return res.status(400).json({ success: false, message: 'Configure sua InfiniteTag em config.json.' });
    }

    const payload = {
      handle,
      redirect_url: redirect_url || `https://${req.get('host')}/obrigado`,
      webhook_url: webhook_url || `https://${req.get('host')}/webhook`,
      order_nsu: order_nsu || uuidv4(),
      customer,
      address,
      items: items || [{ quantity: 1, price: amount || 1000, description: 'Produto Padrão' }]
    };

    const r = await axios.post('https://api.infinitepay.io/invoices/public/checkout/links', payload);

    // Salva no histórico local
    const logsPath = path.join(DATA_DIR, 'pagamentos.json');
    let logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8') || '[]');
    logs.unshift({ id: uuidv4(), created_at: new Date().toISOString(), payload, resposta: r.data });
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));

    return res.json({
      success: true,
      pagamento_url: r.data.url,
      order_nsu: payload.order_nsu
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Rota de agradecimento
app.get('/obrigado', (req, res) => {
  const { receipt_url, order_nsu, capture_method, paid } = req.query;
  res.send(`
    <html><head><title>Pagamento Concluído - DataAI</title></head>
    <body style="font-family:sans-serif;text-align:center;margin-top:50px;">
      <h1>✅ Pagamento Concluído!</h1>
      <p>Pedido: <b>${order_nsu || 'N/A'}</b></p>
      <p>Método: <b>${capture_method || 'Pix/Cartão'}</b></p>
      ${receipt_url ? `<p><a href="${receipt_url}" target="_blank">Ver comprovante</a></p>` : ''}
      <p>Obrigado por comprar com a <b>DataAI</b> 💚</p>
    </body></html>
  `);
});

// Webhook para pagamentos
app.post('/webhook', (req, res) => {
  try {
    const logFile = path.join(DATA_DIR, 'pagamentos.json');
    const logs = JSON.parse(fs.readFileSync(logFile, 'utf-8') || '[]');
    logs.unshift({ id: uuidv4(), tipo: 'webhook', recebido: new Date().toISOString(), dados: req.body });
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

    return res.status(200).json({ success: true, message: null });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
});

// Painel Dashboard
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
// Rota 404 - Página não encontrada
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Informações da API
app.get('/info', (req, res) => {
  res.json({
    api: 'DataAI',
    version: '3.0',
    endpoints: {
      armazenamento: '/a/key={key}/json',
      consultas: '/tipo/dado/json',
      historico_consultas: '/a/consultas/json',
      pagamento: '/pagar',
      obrigado: '/obrigado',
      webhook: '/webhook'
    },
    criador: 'Kaio.kvs — Owner of DataAI'
  });
});

// Backup diário
cron.schedule('0 2 * * *', async () => {
  try {
    const backupName = 'backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.zip';
    const arch = path.join(DATA_DIR, 'backups', backupName);
    const output = fs.createWriteStream(arch);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(DATA_DIR, false);
    await archive.finalize();

    if (config.webhook && config.webhook.url) {
      await axios.post(config.webhook.url, { backup: backupName });
    }

    console.log('Backup diário criado:', backupName);
  } catch (e) {
    console.error('Erro no backup:', e.message);
  }
});

app.listen(PORT, () => console.log(`🚀 DataAI rodando na porta ${PORT}`));
