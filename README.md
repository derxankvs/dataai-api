# DataAI - API

Projeto gerado automaticamente. Contém endpoints para:
- Armazenar JSONs: POST /a/key={key}/json
- Visualizar: GET /a/key={key}/json/view
- Baixar: GET /a/key={key}/json/download
- Consultas públicas: GET /cep/:cep/json, GET /ip/:ip/json, GET /:tipo/:dado/json
- Armazenar consultas: POST /a/consultas/json
- Ver consultas: GET /a/consultas/json/view
- Pagamentos (exemplo InfinitePay): POST /pagar
- Dashboard: GET /dashboard

## Config
Edite o arquivo `config.json` e insira seu token da InfinitePay em `infinitepay_token`.
Configure `webhook.url` se quiser receber backups diários via webhook.

## Rodar
1. Instale dependências: `npm install`
2. Inicie: `npm start`
