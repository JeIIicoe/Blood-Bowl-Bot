import DiscordJS, { Intents, Interaction, Role } from 'discord.js'
import * as fs from 'fs' //fs.readFileSync('foo.txt','utf8');
import 'dotenv/config'
import { getBorderCharacters, table } from 'table';
import { Bet, Game } from "./game"

let gameStore: Game[] = []

const client = new DiscordJS.Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
})
const channelID = '<channelID here>'

client.on('ready', () => {
    //db stuff
    console.log('JadeBot is ready!!')

    const guildID = '<guildID here>'
    const guild = client.guilds.cache.get(guildID)
    let commands

    if (guild) {
        commands = guild.commands
    } else {
        commands = client.application?.commands
    }

    //ADMIN COMMANDS --------------------------------------------------------------------------------------------

    // Starts a game.
    // Needs 3 parameter - game name, team name, and the other team name.
    commands?.create({
        name: 'start',
        description: 'Start a game, allowing users to bet for 5 minutes.',
        options: [
            {
                name: 'game-name',
                description: 'Please give the game an easy name',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'first-team',
                description: 'The first team',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'second-team',
                description: 'The second team',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]
    })

    commands?.create({
        name: 'emergency-funds',
        description: 'When agreed upon, use this to reset someones JadeCoins to 2000.',
        options: [
            {
                name: 'discord-name',
                description: 'Please provide a valid DISCORD name for the player you are providing money too.',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]
    })

    // Ends a game.
    // Needs 1 parameter - game name of a game in progress.
    commands?.create({
        name: 'end',
        description: 'Ends a game, and deals out rewards, only use this when a game is complete!',
        options: [
            {
                name: 'game-name',
                description: 'Please provide a valid game name that needs ending.',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'winning-team',
                description: 'The winning team.',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]
    })

    // Displays the games currently active.
    // Needs no parameters from the user.
    commands?.create({
        name: 'current-games',
        description: 'Use this to show the games currently being played.',
    })

    // PLAYER COMMANDS -----------------------------------------------------------------------------------------

    // View current money of user
    // Needs 1 parameter - user
    commands?.create({
        name: 'view-me',
        description: 'View how much money you have.',
    })

    // Places a bet.
    // Needs 3 parameters - game name, team they want to win, and bet amount
    commands?.create({
        name: 'bet',
        description: 'Place yer bets!',
        options: [
            {
                name: 'game-name',
                description: 'Please provide a valid game name that you are betting on. YOU CAN BET ONCE PER GAME',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'team',
                description: 'Please provide a valid team name for who you are betting for.',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            },
            {
                name: 'bet-amount',
                description: 'How much Jadecoin you are betting.',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.NUMBER
            }
        ]
    })

    // Has the bot print the leaderboard.
    // Needs no parameters from the user.
    commands?.create({
        name: 'leaderboard',
        description: 'Open up the leaderboard and see who is winning.',
    })

    // Does something insane.
    // Needs no parameters from the user.
    commands?.create({
        name: 'rtl',
        description: 'Dont do it motherfucker.',
    })

    commands?.create({
        name: 'view-bets',
        description: 'View all bets currently on this game.',
        options: [
            {
                name: 'game-name',
                description: 'Please provide a valid game name that you are betting on. YOU CAN BET ONCE PER GAME',
                required: true,
                type: DiscordJS.Constants.ApplicationCommandOptionTypes.STRING
            }
        ]
    })

})

client.on('interactionCreate', async (interaction) => {
    // await mongoose.connect(process.env.MONGO_URI || '',
    //     {
    //         keepAlive: true
    //     }
    // )

    function getUserID() {
        return interaction.user.id
    }

    function getDiscordName() {
        return interaction.user.username
    }

    function getUserName() {
         const json = JSON.parse(JSON.stringify(interaction.member?.roles))
         const nameData = json.member.displayName
        return nameData
    }

    function alertUsers(response: string) {
        const channel = client.channels.cache.find( ({id}) => id === channelID) // needs changing
        if (channel?.isText()) {
            channel.send(response)
        }
    }

    function checkAmount(amount: number, obj: any): boolean {
        const ID = getUserID()
        const found = obj.find( ({ id } : {id:string}) => id === ID)
        if (found.amount < amount || amount < 0) {
            return false
        } else {
            let newBalance = found.amount - amount
            const objIndex = obj.findIndex(((obj: {id: string, discordName: string, amount: number, wins: number}) => obj.id === ID))
            obj[objIndex].amount = newBalance
            const newData = JSON.stringify(obj)
            fs.writeFileSync('ledger.json', newData)
            return true
        }
    }

    function getMyAmount(obj: any): number {
        const ID = getUserID()
        const found = obj.find( ({ id } : {id:string}) => id === ID)
        return found.amount 
    }

    function addCommas(x: number): string {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
    

    if (!interaction.isCommand()) {
        return
    }
    
    const { commandName, options } = interaction

    if (commandName === 'bet') { //needs game-name, team, and bet-amount
        let response = ''
        const data = fs.readFileSync('ledger.json', 'utf8')
        const obj = JSON.parse(data)
        const ID = getUserID()
        const UN = getUserName()
        const gameName = options.getString('game-name') || ''
        const team = options.getString('team') || ''
        const betAmount = options.getNumber('bet-amount') || 0
        let hasBet = false
        const found = gameStore.find( ({ name }) => name === gameName) //found = current game
        const currentBets = found?.getBets() || []

        if (found === undefined) {
            response = ":warning: This game doesn't exist. Did you type the name wrong dumb dumb?"
        } else {

            if (obj.some((user: { id: string }) => user.id === ID)) {

            } else {
                const dcUn = getDiscordName()
                obj.push({id: ID, discordName: dcUn, amount: 5000, wins: 0})
                const json = JSON.stringify(obj)
                fs.writeFileSync('ledger.json', json, 'utf8')
                const alert = `New user, ${dcUn}, registered to bot.`
                alertUsers(alert)
            }

            if (found.canTakeBets() != false) {               
                for (let a of currentBets) {
                    if (a.gamblerID === ID) {
                        response = ":warning: You can't bet on the same game twice!"
                        hasBet = true
                        break
                    }
                }
                if (hasBet == false) {
                    if (found?.getTeam1() === team) {

                        const myMon = addCommas(getMyAmount(obj) - betAmount)
                        if (checkAmount(betAmount, obj) == true) {
                            if (betAmount >= 1000) {
                                // place the bet
                                found.addBet({ gamblerID: ID, gamblerName: UN, teamBet: team, amount: betAmount})
                                let x = addCommas(betAmount)
                                response = `Your bet was successfully placed. :white_check_mark:\n\n**Bet Amount:** ${x} JadeCoin | **Game You Bet On:** ${gameName} | **Team You Bet On:** ${team} | Remaining JadeCoin: **${myMon}**`
                            } else {
                                response = `:warning: Bets must be a minimum of **1000** JadeCoin to be placed!`
                            }
                        } else {
                            response = ":warning: You don't have enough for this bet!"
                        }

                    } else if (found?.getTeam2() === team) {

                        const myMon = addCommas(getMyAmount(obj) - betAmount)
                        if (betAmount >= 1000) {
                            if (checkAmount(betAmount, obj) == true) {
                                // place the bet
                                found.addBet({ gamblerID: ID, gamblerName: UN, teamBet: team, amount: betAmount})
                                let x = addCommas(betAmount)
                                response = `Your bet was successfully placed. :white_check_mark:\n\n**Bet Amount:** ${x} JadeCoin | **Game You Bet On:** ${gameName} | **Team You Bet On:** ${team} | Remaining JadeCoin: **${myMon}**`
                            } else {
                                response = ":warning: You don't have enough for this bet!"
                            }
                        } else {
                            response = `:warning: Bets must be a minimum of **1000** JadeCoin to be placed!`
                        }

                    } else if (team === 'Draw') {

                        const myMon = addCommas(getMyAmount(obj) - betAmount)
                        if (betAmount >= 1000) {
                            if (checkAmount(betAmount, obj) == true) {
                                // place the bet
                                found.addBet({ gamblerID: ID, gamblerName: UN, teamBet: team, amount: betAmount})
                                let x = addCommas(betAmount)
                                response = `Your bet was successfully placed. :white_check_mark:\n\n**Bet Amount:** ${x} JadeCoin | **Game You Bet On:** ${gameName} | **You have bet on a draw.** | Remaining JadeCoin: **${myMon}**`
                            } else {
                                response = ":warning: You don't have enough for this bet!"
                            }
                        } else {
                            response = `:warning: Bets must be a minimum of **1000** JadeCoin to be placed!`
                        }

                    } else {
                        response = ":warning: This team either doesn't exist or isn't playing in this game. If you're trying to bet on a draw, do Draw. (Capital D necessary)."
                    }
                }
            } else {
                response = `:warning: **${gameName}** can no longer be bet on! Sorry slowpoke! :hourglass:`
            }
        }
        interaction.reply({
            content: `${response}`
        })

    }

    if (commandName === 'view-bets') {
        const gameName = options.getString('game-name') || ''
        const found = gameStore.find( ({ name }) => name === gameName)
        const currentBets = found?.getBets()
        let response = `__**All bets on ${gameName}:**__\n`
        const config = {border: getBorderCharacters('norc')}
        if (found != undefined) {
            if (currentBets?.length != 0) {

                const team1Bets = currentBets?.filter(({teamBet}) => teamBet === found.getTeam1())
                const team1BetsTable = team1Bets?.map(o => [o.gamblerName, o.amount])
                if (team1Bets?.length != 0) {
                    response += `\n**Bets for ${found.getTeam1()} (${team1Bets!.map(bet => bet.amount ).reduce ((a, b) => a+b, 0)})**\n` //header for team 1 bets
                    response += `\`\`\`${table(team1BetsTable!, config)}\`\`\``
                } else {
                    response += `\n**No bets on ${found.getTeam1()}.**\n`
                }

                const team2Bets = currentBets?.filter(({teamBet}) => teamBet === found.getTeam2())
                const team2BetsTable = team2Bets?.map(o => [o.gamblerName, o.amount])
                if (team2Bets?.length != 0) {
                    response += `\n**Bets for ${found.getTeam2()} (${team2Bets!.map(bet => bet.amount ).reduce ((a, b) => a+b, 0)})**\n` //header for team 1 bets
                    response += `\`\`\`${table(team2BetsTable!, config)}\`\`\``
                } else {
                    response += `\n**No bets on ${found.getTeam2()}.**\n`
                }

                const drawBets = currentBets?.filter(({teamBet}) => teamBet === "Draw")
                const drawBetsTable = drawBets?.map(o => [o.gamblerName, o.amount])
                if (drawBets?.length != 0) {
                    response += `\n**Bets for a Draw (${drawBets!.map(bet => bet.amount ).reduce ((a, b) => a+b, 0)})**\n` //header for team 1 bets
                    response += `\`\`\`${table(drawBetsTable!, config)}\`\`\``
                }

            } else {
                response = `:warning: No bets have been placed on ${gameName} just yet!`
            }
        } else {
            response = `:warning: Couldn't find this active game! Make sure you spelled the game name right, it's case and space sensitive!`
        }

        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'leaderboard') {
        let response = '**The Leaderboard**\nHere are the current standings!\n\n__Place **|** Player     **|** JadeCoin     **|** Wins__'
        const data = fs.readFileSync('ledger.json', 'utf8')
        const obj = JSON.parse(data)
        let counter = 0
        let oneTime = ''
        obj.sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount)
        obj?.forEach((element: { id: string, discordName: string, amount: number, wins: number }) => {
            counter++
            oneTime = counter.toString() + `.      |`
            if(counter == 1) {
                oneTime = `:crown:    |`
            }
            let x = addCommas(element.amount)
            response += `\n**${oneTime}** ${element.discordName} **|** ${x} **|** ${element.wins}`
        });

        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'end') {
        const gameName = options.getString('game-name') || ''   //ending game
        const winner = options.getString('winning-team') || ''  //winning team
        const found = gameStore.find( ({ name }) => name === gameName)
        const currentBets = found?.getBets() || []
        const data = fs.readFileSync('ledger.json', 'utf8')
        const obj = JSON.parse(data)
        let response = ''

        let loserSum = 0
        let winnerSum = 0

        let winnerCount : Bet[] = [];

        let newAmount

        if (winner === 'Draw') {
            response = `**${gameName} is over!** It has ended in a **Draw**. | Here are your winning betters:\n-------------------------------------------------`
        } else {
            response = `**${gameName} is over!** GG to **${winner}!** | Here are your winning betters:\n-------------------------------------------------`
        }

        let currentWinner = ''

        if (found === undefined) {
            response = ":warning: This game doesn't exist, you can't end a game that doesn't exist!!"
        } else {

            winnerCount = currentBets.filter( ({teamBet}) => teamBet === winner )

            currentBets?.forEach((element) => {                                     // Sums up all loser's bets into loserSum
                if (element.teamBet != winner) {
                    loserSum += element.amount
                } else if (element.teamBet == winner) {
                    winnerSum += element.amount
                }
            })

            if (found?.getTeam1() == winner || found?.getTeam2() == winner || winner === 'Draw'){
                let counter = 0
                currentBets?.forEach((element) => {                                 // Goes over EVERY bet in the game's bet list - element is the bet
                    let earnings = 0
                    if(element.teamBet === winner) {                                // True if the current bet's team was the winning team
                        counter++
                        currentWinner = element.gamblerID
                        const objIndex = obj.findIndex(((obj: {id: string, discordName: string, amount: number, wins: number}) => obj.id === currentWinner))
                        
                        earnings = element.amount                                   // How much you bet
                        earnings = (element.amount / winnerSum)

                        if (loserSum === 0) {                                       // if no one lost, you are just given your money back
                            earnings = element.amount
                        }   
                        
                        if (winnerCount.length == 1 && loserSum > 0) {              // If just 1 person wins AND at least 1 person loses, add instead of multiply.
                            earnings = element.amount + loserSum
                        }

                        if (loserSum > 0 && winnerCount.length > 1) {              // if someone lost & more than 1 person won, multiply
                            earnings = Math.round(earnings * loserSum) + element.amount
                        }

                        newAmount = obj[objIndex].amount += earnings
                        obj[objIndex].amount = newAmount
                        obj[objIndex].wins++
                        let x = addCommas(earnings)
                        let y = addCommas(newAmount)
                        response += `\nPlayer: **${element.gamblerName} |** Winnings **${x}** JadeCoin **|** You now have **${y}** JadeCoin`
                    }
                })
                if(counter == 0) {  
                    if (winner === 'Draw') {
                        response = `**${gameName}** is over! It's ended in a **Draw** and none of you guessed correctly. You're all garbage. :partying_face:\n\n**All money has gone to the house.**`
                    } else {
                        response = `**${gameName}** is over! GG to **${winner}** :partying_face: There are **no winners.** You're all garbage. :partying_face:\n\n**All money has gone to the house.**`
                    }
                }

            const newData = JSON.stringify(obj)
            fs.writeFileSync('ledger.json', newData)
            const index = gameStore.indexOf(found)
            gameStore.splice(index, 1)

            } else {
                response = ":warning: This team isn't in this game or doesn't exist. Team names are case sensitive remember!, if you intend to Draw this game - input 'Draw' into the team name."
            }
    }
    
        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'start') {
        let response = ''
        const gameName = options.getString('game-name') || ''
        const game = new Game(gameName)
        const team1 = options.getString('first-team') || ''
        const team2 = options.getString('second-team') || ''
        const roleid = "934854344002666536"

        setTimeout(alertUsers, 240000, `:hourglass: <@&${roleid}> You have **1 minute** left to bet on **${gameName}!**`)
        setTimeout(alertUsers, 300000, `:hourglass: Bets for **${gameName}** have now **ended!**`) //5m = 300,000
        game.addTeam1(team1)
        game.addTeam2(team2)
        if (gameStore.find( ({name}) => name === gameName) == undefined) {
            if (team1 != team2) {
                gameStore.push(game)
                response = `<@&${roleid}> New game successfully created :white_check_mark:\nYou now have 5 minutes to place your bets.\n\nGame Name: **${gameName}**\nTeam 1: **${team1}**\nTeam 2: **${team2}**`
            } else {
                response = `:warning: Team names can't be identical!`
            }
        } else {
            response = `:warning: That game name currently exists! Please do /start again with a different game name!`
        }

        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'view-me') {
        let response = ''
        const data = fs.readFileSync('ledger.json', 'utf8')
        const obj = JSON.parse(data)
        const myMoney = getMyAmount(obj)
        if (myMoney == undefined) {
            response = ":warning: You're not in my system! Place a bet to be added!"
        } else {
            let x = addCommas(myMoney)
            if (myMoney <= 2500) {
                response = `You've **${x} JadeCoins.** Careful, you're nearly broke! :laughing:`
            } else {
                response = `You currently have **${x} JadeCoins** :partying_face:`
            }
        }
        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'current-games') {
        let response = ''
        let length = gameStore.length

        if (length == 0) {
            response = `:warning: There are sadly no games being played right now!`
        } else if (length == 1) {
            response = `There is **1** game being played right now!\n----------------------------------\n\n`
            gameStore?.forEach((element) => {
                response += `**Game Name:** ${element.name}\n**Team 1: **${element.team1}\n**Team 2: **${element.team2}\n\n`
            })
            response += `Happy Betting!`
        } else {
            response = `There are currently **${length}** games being played right now!\n---------------------------------------------\n\n`
            gameStore?.forEach((element) => {
                response += `**Game Name:** ${element.name}\n**Team 1: **${element.team1}\n**Team 2: **${element.team2}\n\n`
            })
            gameStore?.forEach((element) => {
                element.name
            })
        }

        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'emergency-funds') {
        let response = ''
        const discordName = options.getString('discord-name') || ''
        const data = fs.readFileSync('ledger.json', 'utf8')
        const obj = JSON.parse(data)
        const objIndex = obj.findIndex(((obj: {id: string, discordName: string, amount: number, wins: number}) => obj.discordName === discordName))
        if (objIndex != -1) {
            if (obj[objIndex].amount <= 1000) {
                obj[objIndex].amount = 1000
                const newData = JSON.stringify(obj)
                fs.writeFileSync('ledger.json', newData)
                response = `Wow... ${discordName} went bust? :neutral_face:\n\nWell, you're back at **1,000 JadeCoins** now. Don't lose them again, or the admins will have fun making you beg for more!`
            } else {
                response = `:warning: **This is a powerful command.**\n\nThis command resets someone's balance to 1,000. Thus, it can only be used when someone's funds are equal to or less than 1,000 JadeCoins.\n\n**Don't worry though!** This error means nothing has changed :)`
            }
        } else {
            response = `:warning: Player name not recognised, remember:\n\nPlayer names are not their Discord nicknames, but their actual account names. Example = 'Hisui'.\n\nThey are also case sensitive.`
        }

        interaction.reply({
            content: `${response}`
        })
    }

    if (commandName === 'rtl') {
        let rng = Math.floor(Math.random() * 10) + 1;
        let response = ''
        if (rng == 0) {
            response = "WHERE THE FUCK IS THE SLAM?"
        } else if (rng == 1) {
            response = "PLAY YOUR GAMES."
        } else if (rng == 2) {
            response = "You're all getting fouled for this."
        } else if (rng == 3) {
            response = "Han pasado 84 años..."
        } else if (rng == 4) {
            response = "Do you really need a bot to tell you to play your games?"
        } else if (rng == 5) {
            response = "I literally need slam to function. So play your fucking games."
        } else if (rng == 6) {
            response = "Can an admin hurry up and default you?"
        } else if (rng == 7) {
            response = "ROLL :clap: THE :clap: LEAGUE :clap: ROLL :clap: THE :clap: LEAGUE :clap:"
        } else if (rng == 8) {
            response = "Where pound pepehands"
        } else if (rng == 9) {
            response = "You're all unreliable and you should feel bad."
        } else if (rng == 10) {
            response = "Slam?"
        } else {
            response = "Pound?"
        }

        interaction.reply({
            content: `${response}`
        })
    }
})


client.login(process.env.TOKEN || '')