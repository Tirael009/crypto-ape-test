# crypto-ape-test

Тестове завдання: **Wallet Dashboard** (2 блоки) за макетом.

Екран складається з:
- **My Wallet** — баланс, депозит (адреса), вивід (withdraw)
- **Profit / Loss** — інтерактивний графік з перемиканням діапазону

---

## Що тут зроблено
- Next.js (App Router) + **TypeScript only**
- Анімовані значення через **NumberFlow**
- Анімації кнопок через **framer-motion** (`whileHover`, `whileDrag`)
- Дані по транзакціях/історії через **Etherscan API**
- **Всі запити тільки через Server Actions**
- Розділення server/client компонентів
- Серверний кеш результатів на **60 секунд** (з прив’язкою до `publicKey`)

---

## Технології
- Next.js 16 (App Router)
- TypeScript
- `@number-flow/react`
- `framer-motion`
- `ethers`
- Etherscan API

---

## Як запустити локально

1) Встановити залежності:
```bash
npm install
Створити .env.local на основі .env.example:

bash
Копировать код
cp .env.example .env.local
# або вручну створити файл .env.local
Запустити dev сервер:

bash
Копировать код
npm run dev
Відкрити: http://localhost:3000

Перегляд іншого гаманця
Можна передати адресу через query-параметр:

txt
Копировать код
http://localhost:3000/?publicKey=0x...
Якщо publicKey не передано — використовується WALLET_ADDRESS з .env.local.

ENV змінні (обов’язково)
Важливо: .env.local не комітиться. У репозиторії є лише .env.example.

env
Копировать код
CHAIN_ID=11155111

# Sepolia RPC (Infura/Alchemy/QuickNode або інший провайдер)
RPC_URL=

# Гаманець, з якого робиться withdraw (server-side signer)
WALLET_ADDRESS=
WALLET_PRIVATE_KEY=

# USDC mock контракт (Sepolia), decimals = 6
USDC_ADDRESS=
USDC_DECIMALS=6

# Токен для Profit/Loss (по ТЗ: НЕ USDC)
TRACKED_TOKEN_ADDRESS=
TRACKED_TOKEN_DECIMALS=18
TRACKED_TOKEN_PRICE_USD=1

# Etherscan
ETHERSCAN_API_KEY=
ETHERSCAN_API_URL=https://api.etherscan.io/v2/api
ETHERSCAN_BASE_URL=https://sepolia.etherscan.io
Перевірка функціоналу (smoke test)
1) Deposit
Натисни Deposit

Скопіюй адресу

Поповни її тестовими токенами (через Remix / faucet / будь-який тестовий переказ)

Онови сторінку → у списку транзакцій мають з’явитися incoming tx

Deposit у цьому завданні — це показ адреси + історія депозитів (без інтеграції з MetaMask), щоб тримати підхід “server actions only”.

2) Withdraw
Введи адресу отримувача (інший тестовий адрес)

Вкажи суму меншу за баланс

Натисни Withdraw

Має повернутися tx hash + посилання на explorer (ETHERSCAN_BASE_URL)

3) Profit/Loss графік
Перемикай 1H / 6H / 1D — дані мають оновлюватись

Наведи курсор на графік — зверху має змінюватися дата/час і значення (NumberFlow)

Якщо графік “плоский” або по нулях — це нормально, коли немає історії транзакцій для TRACKED_TOKEN_ADDRESS на цьому гаманці або невалідний ETHERSCAN_API_KEY.

Якщо треба швидко нагенерити тестові транзакції:

Задеплоїти mock ERC20 у Sepolia (типу MockUSDC.sol / MockABC.sol)

mint(WALLET_ADDRESS, ...)

transfer(інший_адрес, ...)

Після цього в UI з’явиться історія, і графік матиме точки.
