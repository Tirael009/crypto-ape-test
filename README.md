crypto-ape-test

<img width="2544" height="764" alt="image" src="https://github.com/user-attachments/assets/9dd20406-9e37-4211-b489-67fa72cf1e1c" />
<img width="1288" height="647" alt="image" src="https://github.com/user-attachments/assets/cb8bd3de-444c-416a-a741-9853e1874a7d" />
<img width="1276" height="577" alt="image" src="https://github.com/user-attachments/assets/da156f27-3217-4e57-9290-73f6ead4ae1a" />
<img width="2513" height="639" alt="image" src="https://github.com/user-attachments/assets/521039f9-d379-41a8-a443-482a668cea53" />




Тестове завдання: Wallet Dashboard (2 блоки) за макетом.

Екран складається з:

My Wallet — баланс, депозит (адреса), вивід (withdraw) USDC

Profit / Loss — інтерактивний графік з перемиканням діапазону (1H / 6H / 1D / …)

Що зроблено

Next.js (App Router) + TypeScript only

Анімовані значення через @number-flow/react

Анімації кнопок через framer-motion (whileHover, whileDrag)

Дані по транзакціях/історії через Etherscan API

Усі запити зроблені тільки через Server Actions

Розділення server / client компонентів

Серверний кеш результатів на 60 секунд

Є перевірка безпеки: WALLET_PRIVATE_KEY має відповідати WALLET_ADDRESS


Стек / технології

Next.js 16 (App Router)

TypeScript

ethers

@number-flow/react

framer-motion

Etherscan API

Як запустити локально

Потрібно: Node 18+

Встановити залежності:

npm install


Створити .env.local

Якщо в репозиторії є .env.example:

cp .env.example .env.local


Якщо .env.example немає — просто створи .env.local вручну (шаблон нижче).

Запустити dev:

npm run dev


Відкрити:

http://localhost:3000

Перегляд іншого гаманця (read-only)

Можна передати адресу через query-параметр:

http://localhost:3000/?publicKey=0x...


Якщо publicKey не передано — використовується WALLET_ADDRESS з .env.local.

Важливий нюанс: withdraw завжди підписується приватним ключем із .env.local.
Тобто навіть якщо ти відкрив /?publicKey=інший_гаманець, кнопка Withdraw відправляє транзакцію з WALLET_ADDRESS, бо приватного ключа від чужого гаманця в немає.

ENV змінні
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

Smoke test
1) Deposit

Натисни Deposit

Скопіюй адресу

Поповни її тестовими токенами (будь-яким тестовим переказом)

Онови сторінку → у списку транзакцій мають з’явитися incoming tx


2) Withdraw (USDC)

Введи адресу отримувача

Вкажи суму меншу за баланс

Натисни Withdraw

Має повернутися tx hash + посилання на explorer (ETHERSCAN_BASE_URL)

3) Profit/Loss графік

Перемикай 1H / 6H / 1D / … — дані мають оновлюватись

Наведи курсор на графік — зверху має змінюватися дата/час і значення (NumberFlow)



Контракти для тесту (Remix)

У папці contracts/ лежать прості mock ERC20 контракти, щоб швидко нагенерити транзакції у Sepolia (я роби в через REMIX IDE):

contracts/MockUSDC.sol — decimals = 6

contracts/MockABC.sol — decimals = 18

Як використати (коротко)

Відкрий Remix → підключи Injected Provider (MetaMask) → мережа Sepolia

Задеплой MockUSDC і MockABC

Додай їх адреси у .env.local як:

USDC_ADDRESS=<адреса MockUSDC>

TRACKED_TOKEN_ADDRESS=<адреса MockABC>

Зроби mint на свій WALLET_ADDRESS

для 1000 USDC (6 decimals): mint(WALLET_ADDRESS, 1000000000)

для 1000 ABC (18 decimals): mint(WALLET_ADDRESS, 1000000000000000000000)

Зроби пару transfer на будь-який інший тестовий адрес (щоб була історія)

Онови UI — баланс/історія/графік повинні підтягнутися (інколи треба 10–30 сек)
