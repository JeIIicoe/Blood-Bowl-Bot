# Blood-Bowl-Bot

Very rough workings of a local Discord blood bowl betting bot written in ts with Discord.js, it currently works only with a locally hosted ledger in the form of a JSON file.

Supports discord slash commands.

ledger.json + .env is missing for obvious reasons:
- .env should contain your discord token, TOKEN=yourBotToken
- ledger.ts can be an empty file but it must be made. The bot will create a json array and append user objects inside of it.
- I recommend creating a backupLedger.json & occassionally copy/pasting the current ledger into that in the event of something going wrong.

## Known Problems
- The bot is prone to crash upon numerous requests at the same time at the moment.
- The code file is extremely unreadable. It needs breaking apart.