import dotenv from "dotenv";
import TelegramBot from 'node-telegram-bot-api'
import axios from "axios";

dotenv.config()

const args = process.argv.slice(2);

const checkTimeout = 5 * 60 * 1000
const statusOkMsgTimeout = 120 * 60 * 1000
const statusOkErrorTimeout = 20 * 60 * 1000

const scannedBlockOffset = 100
const notifiedBlockOffset = 100

const start = async () => {
    const token =  args[0]
    const chatId =  args[1]
    const scannerApiUrl =  args[2]

    const bot = new TelegramBot(token, {polling: true});
    bot.on('message', (msg) => {
        if (msg.text != "/info" && msg.chat.id.toString() == chatId) {
            return
        }

        (async () => {
            let rs
            try {
                rs = await axios.get(`${scannerApiUrl}/status`)
                if (rs.status != 200) {
                    await bot.sendMessage(chatId, "🔴 Scanner Api not available")
                    return
                }
            } catch (e) {
                await bot.sendMessage(chatId, "🔴 Scanner Api not available")
                return
            }

            let msg = "🦊 Polkadot 🦊 \n\n"  +
                "🎯 Live height " + rs.data.polkadot.lastHeight + "\n" +
                "🛰 Scanned height " + rs.data.polkadot.lastScannedHeight + "\n" +
                "👀 Notified height " + rs.data.polkadot.lastNotifiedHeight + "\n\n" +
                "🐼 Kusama 🐼 \n\n"  +
                "🎯 Live height " + rs.data.kusama.lastHeight + "\n" +
                "🛰 Scanned height " + rs.data.kusama.lastScannedHeight + "\n" +
                "👀 Notified height " + rs.data.kusama.lastNotifiedHeight + "\n\n"

            await bot.sendMessage(chatId, msg)
        })()
    });

    let lastStatusOkMsgTimeout: number = 0
    let lastErrorsMsgTimeout: number = 0
    let lastIsOk = true
    while (true) {
        console.log("Start check...")
        let info = await checkStatus(scannerApiUrl)

        const now = new Date().getTime()
        console.log("is OK: " + info.isOk)
        if (info.isOk) {
            if (now - lastStatusOkMsgTimeout >= statusOkMsgTimeout || !lastIsOk) {
                console.log("Everything works well!")
                await bot.sendMessage(chatId, "🟢 Everything works well!")
                lastStatusOkMsgTimeout = now
            }
        } else {
            if (now - lastErrorsMsgTimeout >= statusOkErrorTimeout || lastIsOk) {
                console.log("Error: " + info.error)
                await bot.sendMessage(chatId, info.error)
                lastErrorsMsgTimeout = now
            }
        }
        lastIsOk = info.isOk

        console.log("Sleep")
        await new Promise(resolve => setTimeout(resolve, checkTimeout));
    }
}

async function checkStatus(scannerApiUrl: string): Promise<{
    isOk: boolean,
    error: string
}> {
    try {
        const rs = await axios.get(`${scannerApiUrl}/status`, { timeout: 20000 })
        if (rs.status != 200) {
            return {isOk: false, error: "🔴 Scanner Api not available"}
        }

        if (BigInt(rs.data.polkadot.lastScannedHeight) < BigInt(rs.data.polkadot.lastHeight) - BigInt(scannedBlockOffset) ||
            BigInt(rs.data.kusama.lastScannedHeight) < BigInt(rs.data.kusama.lastHeight) - BigInt(scannedBlockOffset)
        ) {
            return {isOk: false, error: "🔴🛰 Last scanned height lags behind from live height"}
        }

        if (BigInt(rs.data.polkadot.lastNotifiedHeight) < BigInt(rs.data.polkadot.lastScannedHeight) - BigInt(notifiedBlockOffset) ||
            BigInt(rs.data.kusama.lastNotifiedHeight) < BigInt(rs.data.kusama.lastScannedHeight) - BigInt(notifiedBlockOffset)
        ) {
            return {isOk: false, error: "🔴👀 Notified height lags behind"}
        }
    } catch (e) {
        return {isOk: false, error: "🔴 Scanner Api not available"}
    }

    return {isOk: true, error: ""}
}

setImmediate(start)
