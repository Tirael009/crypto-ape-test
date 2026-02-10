<<<<<<< HEAD
<<<<<<< HEAD
# crypto-ape-test
тестове завдання
=======
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
=======
# Crypto Wallet Dashboard (Next.js + TypeScript)
>>>>>>> c264460 (Submit test assignment)

Дашборд из 2 блоков:
- `My Wallet` (баланс, депозит, вывод USDC)
- `Profit/Loss` (интерактивный график c range tabs)

## Технологии
- Next.js (App Router)
- TypeScript only
- `@number-flow/react` для анимированных значений
- `framer-motion` для `whileHover` / `whileDrag` анимаций кнопок
- Etherscan API (история транзакций/депозитов и данных для PnL)
- Server Actions для всех запросов

## Быстрый старт
1. Создай `.env.local` на основе `.env.example`.
2. Установи зависимости:
```bash
npm install
```
3. Запусти:
```bash
npm run dev
```
4. Открой `http://localhost:3000`.
5. Для просмотра любого кошелька по публичному ключу открой `http://localhost:3000/?publicKey=0x...`.

## Обязательные env
```env
CHAIN_ID=11155111
RPC_URL=...
WALLET_ADDRESS=0x...
WALLET_PRIVATE_KEY=0x...
USDC_ADDRESS=0x...
USDC_DECIMALS=6
TRACKED_TOKEN_ADDRESS=0x...
TRACKED_TOKEN_DECIMALS=18
TRACKED_TOKEN_PRICE_USD=1
ETHERSCAN_API_KEY=...
ETHERSCAN_API_URL=https://api.etherscan.io/v2/api
ETHERSCAN_BASE_URL=https://sepolia.etherscan.io
```

## Что реализовано
- Рабочий `withdraw` USDC через server action + проверка `balanceOf` до `transfer`.
- Проверка безопасности: `WALLET_PRIVATE_KEY` обязан соответствовать `WALLET_ADDRESS`.
- `withdraw` возвращает понятные ошибки (`invalid recipient`, `same as sender`, `insufficient USDC`, `invalid amount`) без 500.
- `deposit` через адрес кошелька + загрузка последних депозитов из Etherscan.
- PnL без USDC на основе истории `TRACKED_TOKEN_ADDRESS` с server cache 60 сек.
- Кэш и загрузка данных привязаны к `publicKey` (или `WALLET_ADDRESS` по умолчанию).
- Понятные статусы в UI: `Invalid Etherscan API key`, `No token history for tracked token`.
- Hover по графику меняет верхнее значение и подпись времени.
- Все запросы идут через server actions, client/server компоненты разделены.

<<<<<<< HEAD
You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
>>>>>>> 81831fe (Initial commit from Create Next App)
=======
## Remix Smoke (5-7 шагов)
1. Открой контракт `USDC_ADDRESS` в Remix на сети Sepolia и вызови `mint(WALLET_ADDRESS, 1000000000)` для 1000 USDC (6 decimals).
2. На том же контракте вызови `transfer(<любой_другой_адрес>, 1000000)` для 1 USDC.
3. Открой контракт `TRACKED_TOKEN_ADDRESS` и вызови `mint(WALLET_ADDRESS, 1000000000)` (для текущего tracked токена с 6 decimals).
4. На tracked контракте вызови `transfer(<любой_другой_адрес>, 1000000)`.
5. Подожди 10-30 секунд, обнови UI и переключи `1H/6H/1D` — график должен иметь точки.
6. В `Withdraw` введи валидный адрес и сумму меньше баланса — должен появиться tx hash и ссылка на `sepolia.etherscan.io`.
>>>>>>> c264460 (Submit test assignment)
