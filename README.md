# Example Discord Bot Handler - V14

- Project built on `discord.js` v14.
- Minimum required Node.js version: v18
- Example command setup can be found in [`src/Commands/info/ping.js`](https://github.com/memte/ExampleBot/blob/v14/src/Commands/info/ping.js).
  For more details, visit the [Discord.js Guide](https://discordjs.guide/slash-commands/advanced-creation.html).

- **Note:** Remember to configure your settings in the [`config.js`](https://github.com/memte/ExampleBot/blob/v14/src/Base/config.js) file and Don't forget to prepare a .env file in the same way as in [`.env.example`](https://github.com/memte/ExampleBot/blob/v14/.env.example)!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=memte/ExampleBot&type=Date)](https://www.star-history.com/#memte/ExampleBot&Date)

## 🌟 Support the Project

- If you find this project helpful, consider giving it a ⭐ on GitHub!

![Vote](https://user-images.githubusercontent.com/63320170/175336722-373eaf92-1454-4bce-b97c-e8a629c2628e.png)

## 🧭 Paleidimo tutorialas

1. **Įdiekite priklausomybes**

   ```bash
   npm install
   ```

2. **Sukonfigūruokite `.env`**

   Užpildykite `.env` failą:

   - `BOT_TOKEN` – jūsų Discord botos tokenas
   - `OWNER_IDS` – jūsų Discord ID (gali būti keli, atskirti kableliu)
   - `SUPPORT_CHANNEL_ID`, `LOG_CHANNEL_ID`, `BUY_SELL_CHANNEL_ID` – kanalų ID
   - `SUPPORT_ROLE_ID` – support rolės ID
   - `PRICE_EUR_PER_MILLION` – pradinė kaina EUR
   - `BTC_EUR_RATE`, `LTC_EUR_RATE`, `ETH_EUR_RATE` – rezervinės kainos (jei CoinGecko nepasiekiamas)
   - `BTC_ADDRESS`, `LTC_ADDRESS`, `ETH_ADDRESS` – piniginės adresai
   - `PAYMENT_CHECK_INTERVAL_MS` – tikrinimo intervalas (ms)
   - `PAYMENT_OFFSET_CENTS` – unikalus kainos offsetas centais
   - `DELIVERY_URL` – jūsų API endpoint (pvz. `http://localhost:8080/withdraw`)
   - `DELIVERY_API_KEY` – API raktas
   - `VOUCHES_CHANNEL_ID` – vouches kanalo ID
   - `MIDDLEMAN_CHANNEL_ID` – middleman kanalo ID
   - `MIDDLEMAN_ACCOUNTS` – 20 account nickų, atskirtų kableliais
   - `BACKEND_BASE_URL` – backend bazinis URL (pvz. `http://localhost:8080`)
   - `BACKEND_WS_URL` – backend WebSocket URL (pvz. `ws://localhost:8080`)
   - `BACKEND_API_KEY` – API raktas

3. **Paleiskite botą**

   ```bash
   npm start
   ```

4. **Komandų registracija**

   Slash komandos registruojamos paleidimo metu. Jei pirmą kartą paleidus neveikia, perkraukite botą po kelių sekundžių.

5. **Naudojimas**

   - `/panel-support` – sukuria support panelę
   - `/buy-panel` – sukuria buy panelę
   - `/setprice` – pakeičia EUR kainą ir atnaujina buy panelę
   - `/confirm-payment` – rankinis patvirtinimas (jei reikia)
   - `/verify` – priverstinis kripto mokėjimo patikrinimas (support/seller/owner)
   - `/setnick` – sellerio payout nick nustatymas (middleman išmokėjimams)

6. **Automatinis kripto mokėjimų tikrinimas**

   - Botas automatiškai tikrina BTC/LTC/ETH mokėjimus per BlockCypher balansų polling.
   - Kai vartotojas pasirenka mokėjimo metodą, sistema užfiksuoja pradinį balansą ir kas `PAYMENT_CHECK_INTERVAL_MS` tikrina delta.
   - Jei reikia priverstinai patikrinti, naudokite `/verify` buy threade.

7. **Middleman service**

   - Middleman kanale parašykite žinutę su 2 paminėjimais (buyer ir seller). Žinutė bus ištrinta, o botas sukurs threadą.
   - Thread’e paspauskite **Start Service**, įveskite account nick ir amount.
   - Botas parinks vieną iš `MIDDLEMAN_ACCOUNTS` ir pateiks instrukciją `/pay <nick> <amount>`.
   - Paspaudus **I have added**, botas išsiunčia deposit requestą į backendą ir laukia WS patvirtinimo.
   - Kai backend patvirtina, buyer’ui atsiranda mygtukai **I received items** arba **No, I haven't received anything**.
   - Pasirinkus **I received items**, botas siunčia išmokėjimą per backendą (su 5% fee).

8. **Backend API (HTTP/WebSocket)**

   - HTTP:
     - `POST http://localhost:8080/api/deposit` `{ "nick": "<player>", "amount": <number>, "source": "discord" }`
     - `POST http://localhost:8080/api/withdraw` `{ "nick": "<player>", "amount": <number>, "source": "discord" }`
     - `GET http://localhost:8080/health`
   - WebSocket:
     - `ws://localhost:8080`
     - Send JSON:
       - `{ "type": "deposit", "nick": "<player>", "amount": <number>, "source": "discord" }`
       - `{ "type": "withdraw", "nick": "<player>", "amount": <number>, "source": "discord" }`
       - `{ "type": "status" }`
     - Listen for events:
       - `deposit_wait`
       - `deposit_assigned`
       - `deposit_paid`
       - `deposit_confirmed`
       - `withdraw_assigned`
       - `withdraw_confirmed`
       - `withdraw_failed`

### [Click here for the Discord.js V13 version.](https://github.com/memte/ExampleBot/tree/v13)
