# 🏛️ Verzel Fine Art Auctions — Casa de Leilões em Tempo Real

Plataforma full-stack de leilões de obras de arte em tempo real desenvolvida para o desafio técnico **Elite Dev — Verzel**. O sistema integra o acervo público do **Art Institute of Chicago**, operando com motor transacional de lances protegido contra condições de corrida (*Pessimistic Locking*), gestão atômica de saldo comprometido, prorrogação automática (*Anti-Sniping*), salas ao vivo via WebSockets e auditoria pública com detecção matemática de adulteração via **Cadeia Criptográfica de Hashes (HMAC-SHA256)**.

---

## 🔗 Links Oficiais de Produção

* **Aplicação Web (Front-End — Vercel):** [https://verzel-elite-dev-auction.vercel.app](https://verzel-elite-dev-auction.vercel.app)
* **API & WebSockets (Back-End — Render):** [https://verzel-elite-dev-auction.onrender.com/api/lots](https://verzel-elite-dev-auction.onrender.com/api/lots)
* **Repositório GitHub:** [https://github.com/Wiiur/verzel-elite-dev-auction](https://github.com/Wiiur/verzel-elite-dev-auction)

---

## 🛠️ Stack Tecnológica e Ferramentas

| Camada | Tecnologias e Bibliotecas |
| :--- | :--- |
| **Front-End** | **Next.js 16.4** (App Router & Turbopack), **React 19**, **TypeScript**, **Tailwind CSS** (com suporte a **Dark/Light Mode**), **Socket.io Client**, **Lucide Icons**. |
| **Back-End** | **NestJS 12** (Arquitetura Modular orientada a Domínio), **TypeScript 6**, **Socket.io** (WebSockets), **@nestjs/schedule** (Cron Jobs de ciclo de vida e liquidação), **Passport & JWT**, **Bcrypt**, **Class-Validator**. |
| **Banco de Dados** | **PostgreSQL 16** + **Prisma ORM** (Transações interativas ACID e *Row-Level Locking*). |
| **Testes & Qualidade** | **Jest 30** + **@swc/jest** (Testes unitários de alta performance para regras de lance, carteira, anti-sniping e integridade criptográfica). |
| **Infra & DevOps** | **Docker Compose** (PostgreSQL containerizado), **Render** (Back-End), **Neon/Supabase** (Cloud PostgreSQL), **Vercel** (Front-End). |

---

## 🛡️ Arquitetura e Decisões de Engenharia

### 1. Histórico à Prova de Adulteração (Tamper-Proof HMAC-SHA256 Hash Chain)
Para atender ao requisito crítico do desafio — *"Qualquer alteração, remoção ou inserção posterior no histórico (mesmo direto no banco de dados) deve ser detectada pela auditoria"* — foi projetado um protocolo de **Encadeamento Criptográfico Autenticado (HMAC-SHA256 Hash Chaining)** inspirado na estrutura de blocos imutáveis de *Blockchains*:

1. **Bloco Gênesis (`Genesis Hash`):**
   Cada lote possui uma assinatura inicial determinística derivada do seu identificador único e da chave secreta do servidor (`AUDIT_HMAC_SECRET`):
   $$\text{GenesisHash} = \text{HMAC-SHA256}(\text{Secret}, \text{"GENESIS:"} \parallel \text{lotId})$$

2. **Encadeamento Estrito (`sequenceNumber` + `previousHash`):**
   Cada lance recebe um número sequencial monotônico estrito ($1, 2, 3, \dots, n$) dentro do lote e armazena o hash exato do lance imediatamente anterior (`previousHash`). No lance `#1`, o `previousHash` deve ser obrigatoriamente igual ao `GenesisHash`.

3. **Assinatura Criptográfica do Lance (`bidHash`):**
   No momento exato da transação, o `HashChainService` gera o selo criptográfico do lance concatenando todos os metadados críticos:
   $$\text{Payload} = \text{lotId} \parallel \text{sequenceNumber} \parallel \text{bidderId} \parallel \text{amount} \parallel \text{createdAtISO} \parallel \text{previousHash}$$
   $$\text{bidHash} = \text{HMAC-SHA256}(\text{Secret}, \text{Payload})$$

4. **Como a Auditoria Pública (`/audit/[lotId]`) Detecta Qualquer Fraude no Banco de Dados:**
   * **Adulteração de Valor, Autor ou Horário (`UPDATE` direto via SQL):** Quando um invasor altera o campo `amount` (ou `bidderId` / `createdAt`) diretamente na tabela `bids`, o motor de auditoria recalcula o `HMAC-SHA256` daquele registro. O hash recalculado diverge imediatamente do `bidHash` armazenado e rompe o elo `previousHash` de todos os lances subsequentes (efeito cascata).
   * **Remoção de Lance (`DELETE` direto via SQL):** Se um lance intermediário (ex: lance `#3`) for apagado do banco, o verificador detecta simultaneamente o salto ilegal no `sequenceNumber` (de `#2` para `#4`) e a quebra do elo criptográfico, pois o `previousHash` do lance `#4` não bate com o `bidHash` do lance `#2`.
   * **Inserção Forjada (`INSERT` direto via SQL):** Mesmo que alguém com acesso total ao banco de dados tente inserir um lance falso e recalcular os hashes `SHA-256` manualmente via SQL, a tentativa falhará porque a função utiliza **HMAC** com uma chave simétrica secreta (`AUDIT_HMAC_SECRET`) armazenada exclusivamente nas variáveis de ambiente da aplicação, fora do banco de dados.

---

### 2. Controle de Concorrência e Prevenção de Condições de Corrida (*Race Conditions*)
Em leilões disputados em tempo real, múltiplos licitantes podem enviar lances no mesmo milissegundo. Para impedir que dois lances leiam o mesmo `currentPrice` simultaneamente ou corrompam o encadeamento do `sequenceNumber`:
* O método `BiddingService.placeBid()` executa uma **Transação Interativa ACID (`prisma.$transaction`)** iniciada por um **Bloqueio Pessimista a nível de linha (*Pessimistic Row-Level Lock*)**:
  ```sql
  SELECT id FROM "lots" WHERE id = $1 FOR UPDATE
  ```
* Qualquer requisição concorrente para o mesmo lote aguarda na fila do PostgreSQL até que a transação anterior confirme o novo preço, atualize os saldos e grave o hash encadeado.

---

### 3. Gestão Atômica de Carteira e Saldo Comprometido
Todos os valores financeiros são armazenados e processados em **centavos (`Int`)**, eliminando erros de precisão de ponto flutuante (IEEE 754).
* **Fórmula de Liquidez:** $\text{Saldo Disponível} = \text{Saldo Total} - \text{Saldo Comprometido}$.
* **Ao assumir a liderança de um lote:** Dentro da mesma transação atômica do lance:
  1. O sistema verifica se o usuário possui `availableBalance >= bidAmount`.
  2. Caso exista um líder anterior no lote, o `committedBalance` desse líder anterior é **imediatamente liberado (`decrement`)**.
  3. O `committedBalance` do novo líder é **imediatamente bloqueado (`increment`)**.
* **Impedimento de Autolance:** O licitante que já detém o maior lance ativo do lote é bloqueado de cobrir a própria oferta, evitando travamento desnecessário de saldo.
* **Liquidação Financeira no Encerramento (`LotLifecycleService`):**
  * **Com Vencedor (`FINISHED`):** Debita em definitivo o `totalBalance` e o `committedBalance` do licitante vencedor, transfere o montante para o `totalBalance` do Leiloeiro responsável e emite o **Comprovante Oficial de Arremate (`Receipt`)** assinado via `SHA-256`.
  * **Sem Lances (`UNSOLD`):** O lote é encerrado sem movimentação financeira.
  * **Cancelamento antes do término (`CANCELLED`):** Se já houver lances registrados, o `committedBalance` do líder atual é integralmente estornado na mesma transação e o lote é removido da vitrine pública (permanecendo visível no histórico administrativo do leiloeiro).

---

### 4. Regra Anti-Sniping (Prorrogação Automática em Tempo Real)
Para evitar que robôs ou usuários dêem lances no último segundo sem chance de reação dos concorrentes:
* Sempre que um lance válido é confirmado faltando **menos de 2 minutos (`120.000 ms`)** para o `endsAt` do lote, o servidor estende automaticamente o horário de encerramento em **+2 minutos** (`newEndsAt = endsAt + 2 min`).
* O evento WebSocket `bidPlaced` transmite instantaneamente o novo `endsAt` e a flag `antiSnipingTriggered: true` para todos os clientes conectados na sala, atualizando os cronômetros regressivos sem recarregar a página.

---

### 5. Resiliência contra Falhas da API Externa (*Snapshot Pattern* + *Fallback Catalog*)
Os itens leiloados são buscados na API pública do **Art Institute of Chicago (`https://api.artic.edu/api/v1/artworks`)**:
* **Timeout, Cache em Memória e Catálogo de Contingência:** O `ExternalCatalogService` implementa controle de timeout (`6s`), cache em memória com TTL e um catálogo curado de *fallback* caso a API do museu sofra instabilidade ou *rate-limiting*.
* **Snapshot Imutável no Banco:** No momento em que o leiloeiro cria um lote, os metadados essenciais da obra (`title`, `description`, `imageUrl`, `attributesJson`) são persistidos no PostgreSQL. Isso garante que **100% das vitrines, salas ao vivo, auditorias e comprovantes continuem funcionando perfeitamente** mesmo que a API externa saia do ar.

---

### 6. Privacidade por Design (*Privacy by Design*)
* Nenhum endpoint público, payload de WebSocket, histórico de lances, página de auditoria ou comprovante compartilhável expõe o `name`, `email` ou `id` interno dos participantes.
* Todos os usuários operam publicamente através de um identificador pseudonimizado único gerado no cadastro (ex: `Licitante #A7F2`, `Leiloeiro #OFICIAL`).

---

## 📂 Estrutura do Repositório (Monorepo)

```text
verzel-elite-dev-auction/
├── docker-compose.yml               # Container PostgreSQL 16 pronto para uso local
├── README.md                        # Documentação técnica e guia de execução
├── backend/                         # API REST + WebSockets + Cron + Prisma (NestJS 12)
│   ├── prisma/
│   │   ├── schema.prisma            # Modelagem relacional (User, Lot, Bid, Receipt)
│   │   └── seed.ts                  # População rica com cadeias de hashes válidas
│   └── src/
│       ├── common/
│       │   ├── crypto/              # HashChainService + Testes Unitários (.spec.ts)
│       │   └── prisma/              # PrismaService global
│       └── modules/
│           ├── auth/                # Autenticação JWT, Guards e Registro com Alias
│           ├── wallet/              # Depósito, Extrato de Carteira e Meus Arremates
│           ├── catalog/             # Integração resiliente com Art Institute of Chicago
│           ├── lots/                # Criação, Vitrine, Cancelamento e Cron Lifecycle
│           ├── bidding/             # Motor de Lances, Lock Pessimista, Socket.io e Testes
│           └── audit/               # Verificador criptográfico público e Comprovantes
└── frontend/                        # Interface Reativa em Tempo Real (Next.js 16 App Router)
    └── src/
        ├── app/
        │   ├── page.tsx             # Vitrine Pública (Ao Vivo, Agendados, Encerrados + Busca)
        │   ├── login/               # Autenticação + Acesso Rápido (1-Click Demo Login)
        │   ├── lots/[id]/           # Sala do Lote em Tempo Real (WebSocket + Cronômetro)
        │   ├── auctioneer/          # Painel do Leiloeiro (Busca na API Externa e Gestão)
        │   ├── wallet/              # Carteira (Total, Comprometido, Disponível) e Arremates
        │   ├── audit/[lotId]/       # Página Pública de Auditoria Criptográfica
        │   └── receipts/[id]/       # Comprovante Oficial Compartilhável
        ├── components/              # Navbar reativa com saldo em tempo real e Dark Mode
        ├── contexts/                # AuthContext e ThemeContext
        └── services/                # Cliente HTTP tipado e formatação monetária
```

---

## ⚙️ Como Configurar e Executar o Projeto Localmente

### Pré-requisitos
* **Node.js** `v20+` (recomendado `v22` ou `v24`)
* **PostgreSQL 16+** instalado localmente **OU** **Docker Desktop** para subir o banco em 1 comando.

---

### Passo 1: Clonar o Repositório e Subir o Banco de Dados
```bash
git clone [https://github.com/Wiiur/verzel-elite-dev-auction.git](https://github.com/Wiiur/verzel-elite-dev-auction.git)
cd verzel-elite-dev-auction
```

Caso utilize **Docker**, suba o banco PostgreSQL com:
```bash
docker compose up -d
```
*(Se já possuir o PostgreSQL rodando localmente na porta `5432`, basta criar um banco chamado `auction_house`).*

---

### Passo 2: Configurar e Iniciar o Back-End (`porta 3001`)
Abra um terminal na pasta `backend`:
```bash
cd backend
npm install
```

Crie um arquivo **`.env`** na pasta `backend` (ou copie de `.env.example`):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/auction_house?schema=public"
JWT_SECRET="verzel-elite-dev-jwt-secret-2026"
AUDIT_HMAC_SECRET="verzel-elite-dev-hmac-secret-2026"
PORT=3001
```
*(Ajuste a senha do `DATABASE_URL` caso utilize uma senha própria no seu PostgreSQL local).*

Execute as migrações do Prisma e rode o **Seed Obrigatório**:
```bash
npx prisma migrate dev --name init
npm run seed
```

Inicie o servidor Back-End em modo de desenvolvimento:
```bash
npm run start:dev
```
O servidor estará ativo em `http://localhost:3001/api` e o WebSocket Gateway em `http://localhost:3001`.

---

### Passo 3: Configurar e Iniciar o Front-End (`porta 3000`)
Abra um **segundo terminal** na pasta `frontend`:
```bash
cd frontend
npm install
```

Crie um arquivo **`.env.local`** na pasta `frontend` (ou copie de `.env.example`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

Inicie a aplicação Next.js:
```bash
npm run dev
```
Acesse **`http://localhost:3000`** no seu navegador.

---

## 🧪 Executando os Testes Automatizados

O Back-End conta com testes unitários automatizados (via **Jest + SWC**) cobrindo:
1. **`hash-chain.service.spec.ts`:** Validação de cadeia íntegra, detecção de adulteração de valor no banco (`UPDATE`), detecção de exclusão de lance intermediário (`DELETE`) e detecção de hash forjado sem a chave HMAC (`INSERT`).
2. **`bidding.service.spec.ts`:** Bloqueio de lances por leiloeiros, bloqueio de autolance pelo líder atual, validação de saldo disponível insuficiente (`total - comprometido`) e ativação automática da prorrogação **Anti-Sniping (+2 min)**.

Para rodar a suíte de testes:
```bash
cd backend
npm test
```

---

## 👥 Credenciais Semeadas (Seed Data) e Cenários Prontos

Na página `/login`, você dispõe de botões de **Acesso Rápido (1-Click Login)** para alternar instantaneamente entre Leiloeiro e Licitantes sem digitar senha. Caso prefira login manual, a senha padrão de todas as contas é **`123456`**:

| Papel | Nome Interno | Alias Público | E-mail | Saldo Inicial |
| :--- | :--- | :--- | :--- | :--- |
| **Leiloeiro 1** | Carlos Albuquerque | `Leiloeiro #OFICIAL` | `leiloeiro@verzel.com.br` | R$ 4.200,00 *(recebido)* |
| **Leiloeiro 2** | Helena Sotheby | `Leiloeiro #CURADORIA` | `curadoria@verzel.com.br` | R$ 0,00 |
| **Cliente 1** | Ana Colecionadora | `Licitante #A7F2` | `cliente1@verzel.com.br` | R$ 15.000,00 |
| **Cliente 2** | Bruno Investidor | `Licitante #B9C4` | `cliente2@verzel.com.br` | R$ 22.000,00 |
| **Cliente 3** | Camila Galeria SP | `Licitante #C3D8` | `cliente3@verzel.com.br` | R$ 18.000,00 |
| **Cliente 4** | Diego Mecenas | `Licitante #D5E1` | `cliente4@verzel.com.br` | R$ 30.000,00 |
| **Cliente 5** | Elena Museu Europeu | `Licitante #E2A9` | `cliente5@verzel.com.br` | R$ 25.000,00 |

### Cenários criados automaticamente pelo `npm run seed`:
* **4 Lotes AO VIVO (`ACTIVE`):** Com 18 lances encadeados via `HMAC-SHA256` e saldos comprometidos já sincronizados para cada líder atual (incluindo o lote *"The Bedroom in Arles — Vincent van Gogh"* configurado nos minutos finais para facilitar o teste de **Anti-Sniping** e **Liquidação Automática**).
* **3 Lotes AGENDADOS (`SCHEDULED`):** Prontos para abertura automática pelo Cron Job quando atingirem o `startsAt`.
* **1 Lote ARREMATADO (`FINISHED`):** *"The Starry Night — Vincent van Gogh"*, vencido por **Ana (`cliente1@verzel.com.br`)** por **R$ 4.200,00**, com transferência financeira já liquidada para o Leiloeiro e **Comprovante Oficial Compartilhável** disponível em `/wallet`.
* **1 Lote ENCERRADO SEM LANCES (`UNSOLD`):** *"Composition VIII — Wassily Kandinsky"*.
* **1 Lote CANCELADO (`CANCELLED`):** *"The Persistence of Memory — Salvador Dalí"*, oculto da vitrine pública mas visível para auditoria no Painel do Leiloeiro.

---

## 🔍 Roteiro Rápido para Testar a Detecção de Adulteração no Banco (1 Minuto)

Para comprovar visualmente que qualquer modificação direta no PostgreSQL é flagrada pela Auditoria Pública:

1. No terminal da pasta `backend`, abra o editor visual do banco de dados:
   ```bash
   npx prisma studio
   ```
2. Acesse `http://localhost:5555`, clique na tabela **`Bid`** e altere manualmente o campo `amount` de qualquer lance (ex: de `250000` para `999999`) ou exclua uma linha, clicando em **Save changes**.
3. Na aplicação web (`http://localhost:3000`), clique em **"Auditar Hashes"** no lote correspondente (ou acesse `/audit/[lotId]`).
4. O painel exibirá imediatamente o alerta vermelho **"ALERTA CRÍTICO: Adulteração Detectada no Banco de Dados!"**, destacando em vermelho o bloco exato cujo hash recalculado divergiu do selo original e os elos subsequentes rompidos.
5. Para restaurar a integridade original do banco, basta rodar `npm run seed` na pasta `backend`.

---

## 📡 Resumo dos Endpoints da API e Eventos WebSocket

| Método / Canal | Rota / Evento | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Cadastro de usuário (`BIDDER` ou `AUCTIONEER`) com geração de alias público. |
| `POST` | `/api/auth/login` | Autenticação com retorno de token JWT. |
| `GET` | `/api/wallet/me` | Retorna Saldo Total, Comprometido, Disponível, lotes liderados e arremates. |
| `POST` | `/api/wallet/deposit` | Realiza aporte imediato de fundos na carteira do licitante. |
| `GET` | `/api/catalog/search?q=` | Busca obras na API do *Art Institute of Chicago* (com cache e fallback). |
| `GET` | `/api/lots` | Lista lotes da vitrine filtrados por status (`ACTIVE`, `SCHEDULED`, `ENDED`) e busca textual. |
| `POST` | `/api/lots` | Cria novo lote (exclusivo para `AUCTIONEER`) persistindo snapshot da obra. |
| `PATCH` | `/api/lots/:id/cancel` | Cancela lote agendado/ativo do leiloeiro e estorna saldo comprometido do líder. |
| `POST` | `/api/lots/:id/bids` | Registra lance atômico com lock pessimista, validação de carteira, anti-sniping e HMAC. |
| `GET` | `/api/audit/lots/:lotId` | Recalcula toda a cadeia de hashes do lote e retorna o laudo de integridade. |
| `GET` | `/api/audit/receipts/:id` | Retorna os dados públicos e a assinatura `SHA-256` do comprovante de arremate. |
| `WS (Socket.io)` | `joinLotRoom` / `bidPlaced` | Sala em tempo real do lote com broadcast imediato de lances e prorrogações. |