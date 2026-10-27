# Guardian — versão profissional (protótipo funcional)

Esta versão melhora a interface do projeto e acrescenta um protótipo navegável de mapa, gestão de câmeras, contatos, grupos e mensagens.

## Executar localmente

1. Instale o Node.js LTS.
2. Abra um terminal na pasta `backend_no_db_complete`.
3. Execute `npm install`.
4. Copie `.env.example` para `.env` e configure um segredo JWT forte (não publique o `.env`).
5. Execute `npm run start:static`.
6. Acesse `http://localhost:4000`.

O banco SQLite é criado pelo backend quando inicializado. O login e o cadastro usam as rotas de autenticação existentes.

## O que está implementado nesta entrega

- Interface responsiva com painel, navegação e identidade visual Guardian.
- Tela de login e cadastro conectada às rotas de autenticação já existentes.
- Cadastro local de câmeras com localização, coordenadas opcionais e escolha explícita de visibilidade pública/privada.
- Visualização de mapa do Google Maps incorporado e listagem de câmeras públicas cadastradas nesta sessão/conta local.
- Gestão local de contatos, criação de grupos e conversas de demonstração.
- Composição de mensagens, prévia local de arquivos e ação de referência de câmera em uma conversa.
- Avisos claros quando uma função depende de infraestrutura externa.

## Limitações importantes — antes de usar com pessoas reais

Esta entrega é um protótipo de interface, não uma plataforma de vigilância pronta para produção. Contatos, grupos, mensagens e dados de câmeras da nova interface ficam no armazenamento local do navegador; ainda não são sincronizados entre usuários/dispositivos. Arquivos anexados usam uma URL temporária local e não são enviados para outras pessoas. O formulário de câmera cadastra metadados, mas não conecta nem autentica uma câmera física, RTSP, ONVIF ou WebRTC.

Para uma versão multiusuário real, implementar e testar no servidor:
- APIs autenticadas e autorização por proprietário para câmeras, contatos, grupos e mensagens.
- Armazenamento persistente de mensagens e mídias (por exemplo, S3 compatível), limites de tamanho e verificação de arquivos.
- Transmissão segura compatível com os dispositivos (preferencialmente WebRTC/HLS com autenticação; nunca expor credenciais de câmera no frontend).
- Chave e restrições da Google Maps Platform, política de localização e ocultação de endereços sensíveis.
- Regras de privacidade, consentimento explícito para publicação, auditoria, revogação de compartilhamentos, rate limits, validação de entrada e testes de segurança.
- Configurar `JWT_SECRET` como segredo aleatório forte. O valor de fallback `segredo` do backend original não deve ser usado em produção.

Não compartilhe câmeras privadas no mapa público. A publicação deve ser voluntária e revogável pelo titular. Não coloque URLs de stream com senha ou credenciais em páginas públicas.

## Estrutura principal

- `public/index.html` — aplicação web.
- `public/guardian.css` — estilos responsivos.
- `public/guardian.js` — interações de protótipo.
- `server.js` e `src/routes/` — backend original de autenticação e APIs.

## Próximos passos recomendados

1. Implementar no backend as tabelas e APIs de câmeras com autorização por proprietário.
2. Criar APIs de contatos e convites; validar a existência do usuário no servidor.
3. Implementar grupos e mensagens persistentes com Socket.IO autenticado e autorização por conversa.
4. Integrar armazenamento de vídeos e um pipeline de transmissão seguro.
5. Configurar Google Maps Platform e fazer testes de segurança antes de publicar.

## Organização no VS Code

O projeto inclui configurações na pasta `.vscode/`:

- `settings.json`: formatação automática ao salvar e padrões de edição.
- `extensions.json`: recomenda extensões úteis (Prettier, ESLint, Live Server e suporte a `.env`).
- `launch.json`: configuração para iniciar e depurar o backend pelo painel **Run and Debug**.
- `.prettierrc.json` e `.editorconfig`: padronizam indentação, aspas e finais de linha.

### Estrutura principal

```text
guardian-profissional/
├── .vscode/                 # Configurações do VS Code
├── backend_no_db_complete/
│   ├── public/              # HTML, CSS, JavaScript e recursos da interface
│   ├── src/
│   │   ├── routes/           # Rotas da API separadas por funcionalidade
│   │   └── db.js             # Acesso ao banco de dados
│   ├── scripts/              # Scripts de manutenção e configuração
│   ├── sql/                  # Scripts SQL
│   ├── server.js             # Inicialização do servidor Express
│   ├── package.json          # Dependências e comandos
│   └── .env.example          # Modelo de variáveis de ambiente
├── .editorconfig
└── .prettierrc.json
```

### Instalar e formatar o código

No terminal do VS Code:

```bash
cd backend_no_db_complete
npm install
npm run format
npm run start:static
```

A primeira vez que abrir o projeto, aceite a recomendação de instalar a extensão **Prettier - Code formatter**. Depois, use `Shift + Alt + F` para formatar um arquivo ou salve-o para a formatação automática.

> Antes de executar, copie `.env.example` para `.env` e configure os segredos e credenciais do seu ambiente. Não publique o arquivo `.env` no GitHub.
# domlookscankill
