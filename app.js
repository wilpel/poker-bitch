const playwright = require('playwright');

const fs = require('fs');
const readline = require('readline');

const { takeAction } = require('./strategy.js');

let currentOdds = 0;
let preFlop = false;

let hand = [];
let table = [];
let mySeat = -1;

let hasRaisedThisHand = false;
const setHasRaisedThisHand = (value) => {
    hasRaisedThisHand = value;
}

function extractPlayerHand(data) {
    const players = data.playerStates;

    containerCode = data.containerCode;

    for (let i = 0; i < players.length; i++) {
        if (players[i].cards[0] != "X" && players[i].playerSeat != 0) {
            mySeat = players[i].playerSeat;
            return players[i].cards;
        }
    }
}

function extractTableCards(data) {
    const players = data.playerStates;

    containerCode = data.containerCode;

    for (let i = 0; i < players.length; i++) {
        if (players[i].playerSeat == 0) {
            return players[i].cards;
        }
    }
}

async function call(page) {
    try {
        await page.click("#CALL", { timeout: 100 })
    } catch (e) {
        //console.log(e)
    }
}

async function raise(page) {
    try {
        await page.click("#RAISE_TO, #BET", { timeout: 500 });
    } catch (e) {
        //console.log(e)
    }
}

async function check(page, noClick) {

    try {
        if (noClick) {
            return await page.$('#CHECK') !== null;
        }
        await page.click("#CHECK", { timeout: 200 })
    } catch (e) {
        //console.log(e)
    }
}

async function checkOrFold(page) {
    try {
        if (await check(page, true)) {
            await check(page);
        } else {
            await check(page);
            await page.click("#FOLD", { timeout: 200 })
        }
    } catch (e) {
        //console.log(e)
    }
}

async function getBankroll(page) {
    const element = await page.$('[id^="chips-Dedicatedready3"]');

    if (element) {
        const text = await element.innerText();
        const numericValue = parseFloat(text.replace(/€|kr/i, '').trim());
        return numericValue;
    }
}

async function getPotAmount(page) {
    const element = await page.$('[class="total-pot-amount"]');
    if (element) {
        const text = await element.innerText();
        const numericValue = parseFloat(text.replace(/€|kr/i, '').trim());
        return numericValue;
    }
}

async function countActivePlayerAvatars(page) {
    const activePlayers = await page.$$('.player-avatar:not(.inactive)');
    const count = activePlayers.length;

    return count;
}

function shouldCallPreFlop(hand) {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const handRanks = hand.map(card => card[1]);
    const handSuits = hand.map(card => card[0]);
    const handIsPair = handRanks[0] === handRanks[1];
    const handIsSuited = handSuits[0] === handSuits[1];

    const rankIndex1 = ranks.indexOf(handRanks[0]);
    const rankIndex2 = ranks.indexOf(handRanks[1]);

    if (handIsPair && rankIndex1 >= ranks.indexOf('J') ||
        (handIsSuited && handRanks.includes('A') && handRanks.includes('K'))) {
        return true;
    }

    if ((handIsPair && rankIndex1 >= ranks.indexOf('8')) ||
        (rankIndex1 >= ranks.indexOf('A') && rankIndex2 >= ranks.indexOf('Q'))) {
        return true;
    }

    return false;
}

async function appendToCsv(page) {
    const csvLine = `${new Date().toISOString()},${await getBankroll(page)}\n`;

    fs.appendFile('bankroll_tracking.csv', csvLine, (err) => {
        if (err) {
            console.error('Error writing to CSV file', err);
        } else {
            //console.log('Successfully appended to CSV:', csvLine);
        }
    });
}

async function clickButtonWithTextIfExists(page, buttonText, intervalMs) {
    const checkAndClick = async () => {
        try {
            const buttonSelector = `//button[contains(text(), '${buttonText}')]`;
            const button = await page.$(buttonSelector);
            if (button) {
                await button.click();
                return true; // Button found and clicked
            }
            return false; // Button not found
        } catch (e) {

        }
    };

    return new Promise(resolve => {
        const interval = setInterval(async () => {
            const foundAndClicked = await checkAndClick();
            if (foundAndClicked) {
                clearInterval(interval);
                resolve();
            }
        }, intervalMs);
    });
}

(async () => {
    const browser = await playwright.chromium.launch({ headless: false });
    const page = await browser.newPage();

    clickButtonWithTextIfExists(page, 'Stanna inloggad', 1000);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Function to handle 'force-table' command
    const handleForceTableCommand = async (id) => {
        console.log(`Forcing table with ID: ${id}`);
        // Use the exposed function to send message via WebSocket
        await page.evaluate((id) => {
            window.sendMessageToWebSocket('42["message",{"classId":60004,"data":"Web Client. Filter view play button clicked"}]');
            window.sendMessageToWebSocket(`42["message",{"classId":50054,"requestId":"SearchContainerRequest_9","subContainerType":1,"fun":false,"gameType":null,"betType":null,"currency":null,"first":null,"second":null,"players":null,"filter":{"value":"@common_group@=6699969","condition":null},"orderByStatement":{"value":"@table_name@ like '%Premium%' OR @table_name@ like '%premium%' AND @container_id@ LIKE ` + id + `","condition":null},"playerMetadata":null,"numberOfTables":null,"chips":null,"ticketId":null,"fbTemplateCode":null}]`);
            // window.sendMessageToWebSocket('42["message",{"classId":60004,"data":"Web Client. MTP update. Table code added: '+id+'. All table codes []"}]');
            // window.sendMessageToWebSocket('42["message",{"classId":60004,"data":"Web Client. MTP set active game: '+id+'"}]');
            // window.sendMessageToWebSocket('42["message",{"containerIdsList":['+id+'],"subscriptionType":3,"containerType":0,"requestId":"GetContainersRequest_10","playerMetadata":null,"classId":50008}]');
            // window.sendMessageToWebSocket('42["message",{"requestId":"Lobby_FilterSubscription_8","classId":50022}]');
            // window.sendMessageToWebSocket('42["message",{"classId":60004,"data":"Web Client. Init cash game. ContainerId: '+id+'. Active games: 1"}]');
            // window.sendMessageToWebSocket('42["message",{"containerCode":'+id+',"classId":60023}]');
        }, id);
    };

    rl.on('line', async (input) => {
        const args = input.split(' ');
        if (args[0] === 'force-table' && args[1]) {
            await handleForceTableCommand(args[1]);
        }
    });

    const onGameCards = (data) => {
        const parsedData = JSON.parse(JSON.parse(data.substring(2))[1]);
        try {

            //PLAYER
            const playerCards = extractPlayerHand(parsedData);

            if (hand[0] != playerCards[0] && hand[1] != playerCards[1]) {
                //console.log("New dealt cards " + playerCards + ", you should ", shouldCallPreFlop(playerCards))
                table = [];
                currentOdds = 0;
                hasRaisedThisHand = false;
                appendToCsv(page);
            }

            hand = extractPlayerHand(parsedData);
        } catch (e) {
            //console.log(e)
        }

        try {
            //TABLE
            const tableCards = extractTableCards(parsedData);

            if (tableCards) {

                if (tableCards.length == 3) {
                    table = JSON.parse(JSON.stringify(tableCards));
                    preFlop = false;
                    hasRaisedThisHand = false;
                } else {
                    table.push(tableCards[0]);
                    hasRaisedThisHand = false;
                }
            }

            //if(table.length > 0)
            //console.log(table);
        } catch (e) {
            //console.log(e)
            console.log("")
        }
    }

    await page.exposeFunction('logReceivedMessage', async (data) => {

        //fs.appendFileSync('wss-log.txt', data + '\n');

        if (data.includes("playerStates")) {
            onGameCards(data);
        }

        if (data.includes("playerStates")) {
            console.log(extractPlayerHand(data));
        }
        if (data.startsWith('42["message","{\"handId\"')) {
            const jsonPart = data.substring('42["message",'.length, data.length - 1);

            try {
                const parsedData = JSON.parse(jsonPart);

                if (parsedData && parsedData.containerCode) {
                    console.log('ContainerId:', parsedData.containerCode);
                }
            } catch (e) {
                console.error('Error parsing JSON:', e);
            }
        }



        try {
            if (data.includes("actions")) {
                takeAction(
                    data,
                    page,
                    hand,
                    table,
                    mySeat,
                    hasRaisedThisHand,
                    setHasRaisedThisHand,
                    await countActivePlayerAvatars(page),
                    await getBankroll(page),
                    await getPotAmount(page),
                    call,
                    raise,
                    check,
                    checkOrFold
                );
            }
        } catch (e) {
            console.log("")
        }
    });

    await page.exposeFunction('sendMessageToWebSocket', (message) => {
        page.evaluate((message) => {
            window.myWebSocket.send(message);
        }, message);
    });

    await page.addInitScript(() => {
        const originalWebSocket = window.WebSocket;
        window.WebSocket = function (...args) {
            const socket = new originalWebSocket(...args);
            window.myWebSocket = socket; // Store reference for sending messages

            socket.addEventListener('message', event => {
                window.logReceivedMessage(event.data);
            });

            const originalSend = socket.send;
            socket.send = function (data) {
                window.logReceivedMessage(data);
                return originalSend.apply(this, arguments);
            };

            return socket;
        };
    });

    await page.goto('https://spela.svenskaspel.se/logga-in?returnUrl=%2Fpoker&w=t&lm=b&lis=f&lt=53ea819f-6771-4239-b7c0-dbcfda571aa8&ltt=2&ts=1702151267698');
    await page.click('button[title="Gå till slutet"]');
    await page.click('button:has-text("Acceptera")');
    await page.click('button:has-text("Mobilt bankid")');
    await page.click('button:has-text("PERSONNUMMER")');
    await page.fill('input[placeholder="ÅÅÅÅMMDD-XXXX"]', '20030521-2912');
    await page.click('button:has-text("Starta mobilt bankid")');
})();
