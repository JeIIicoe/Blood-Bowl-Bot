# Blood-Bowl-Bot

Very rough workings of a local Discord blood bowl betting bot written in ts with Discord.js with a locally hosted ledger.

Supports /commands.

ledger.json + .env is missing for obvious reasons:
- .env should contain your discord token, TOKEN=yourBotToken
- ledger.ts can be an empty file but it must be made. The bot will add create the json object inside of it and write/read from the file.

## Known Problems
- The bot is prone to crash upon numerous requests at the same time at the moment.
- The code file is extremely unreadable. It needs breaking apart.