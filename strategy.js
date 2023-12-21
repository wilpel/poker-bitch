const { MontecarloEvaluator, CardSet, HandRange } = require('holdem');
const chalk = require('chalk');
const fs = require('fs');
let weights = JSON.parse(fs.readFileSync('weights.json', 'utf8'));
const axios = require('axios');

function logToFile(data) {
    fs.appendFileSync('pokerLog.txt', `${data}\n`);
}

async function takeAction(action, page, hand, table, mySeat, hasRaisedThisHand, setHasRaisedThisHand, activePlayers, bankroll, potAmount, call, raise, check, checkOrFold) {
    try {
        const data = JSON.parse(JSON.parse(action.substring(2))[1]);

        if (data.seatIndex !== mySeat) {
            return;
        }

        //console.clear();
        
        const callAmount = data.actions.find(a => a.actionCode === 3)?.minimumSum || 0;

        const postData = {
            tableId: "table123",
            playerId: "player_1",
            hand: convertCardNotation(hand),
            callAmount,
            bankroll,
            playersLeft:activePlayers,
            potAmount,
            communityCards: convertCardNotation(table)
        };

        // Make the post request to the server
        const response = await axios.post('http://localhost:3000/poker/move', postData);
        
        const actionDecision = response.data.action;
        console.log("Response: " + JSON.stringify(response.data));
        console.log("Action: ", actionDecision);

        // Formatting log data
        //const logData = `Action: ${actionDecision}, Hand: ${hand}, Table: ${table}, Win%: ${winPercentage}, Pot: ${potAmount}, Bankroll: ${bankroll}`;

        await sleep(Math.random() * 1000);

        console.log("checking decision and making move");
        switch (actionDecision) {
            case 0: // Fold
                console.log("Folding based on decision");
                //logToFile(`Folding - ${logData}`);
                await sleep(1345);
                await checkOrFold(page);
                break;
            case 1: // Call
                console.log("Calling based on decision");
                //logToFile(`Calling - ${logData}`);
                await sleep(1345);
                await call(page);
                await check(page);
                break;
            case 2: // Raise
                console.log("Raising based on decision");
                if (Math.random() < 0.45) {
                    //logToFile(`Raising - ${logData}`);
                    await sleep(1345);
                    await raise(page);
                    setHasRaisedThisHand(true);
                } else {
                    console.log("Calling based on decision");
                    //logToFile(`Calling - ${logData}`);
                    await sleep(1345);
                    await call(page);
                    await check(page);
                }
                break;
            case 3: // All in
                console.log("Going All In based on decision");
                //logToFile(`All In - ${logData}`);
                await sleep(1345);
                await raise(page);
                await check(page);
                setHasRaisedThisHand(true);
                break;
        }
    } catch (error) {
        console.error("Error in takeAction:", error);
        //logToFile(`Error - ${error.message}`);
    }
}

// Helper functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function convertCardNotation(cards) {
    return cards.map(card => {
        const suit = card.charAt(0).toLowerCase();
        let value = card.slice(1);

        if (value === '10') {
            value = 'T';
        } else {
            value = ['K', 'Q', 'J', 'A'].includes(value) ? value.toUpperCase() : value.toLowerCase();
        }

        return value + suit;
    });
}


// Exported functions
module.exports = {
    takeAction
};
