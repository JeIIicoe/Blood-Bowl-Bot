export type Bet = {
    gamblerID: string
    gamblerName: string
    amount: number
    teamBet: string
}

export class Game {
    public name: string = ''
    public team1: string = ''
    public team2: string = ''
    public bets: (Bet)[] = []
    public canBet: boolean = true

    constructor(gameName: string) {
        this.name = gameName
        this.stopBets()
    }

    async stopBets() {
        setTimeout(() => this.canBet = false, 300000) //5m = 300,000
    }

    canTakeBets() {
        return this.canBet
    }

    addTeam1(team1Name: string) {
        this.team1 = team1Name
    }

    getTeam1() {
        return this.team1
    }

    getTeam2() {
        return this.team2
    }

    addTeam2(team2Name: string) {
        this.team2 = team2Name
    }

    addBet(value: Bet) {
        this.bets = [...this.bets, value]    
    }

    getBets() {
        return this.bets
    }
}