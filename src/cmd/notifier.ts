import mongoose from 'mongoose'
import dotenv from "dotenv";
import {BlockStatus, Network} from "../models/enums/status";
import {Block} from "../models/db/block";
import {notify} from "../notifier/notifier";

dotenv.config()

const args = process.argv.slice(2);

const start = async () => {
    const connectionString = process.env["MONGODB_CONNECTION"] as string
    const subscriberUrl = process.env["SUBSCRIBER_URL"] as string
    const network =  args[0] as Network
    const defaultHeight = args[1] != "" ? BigInt(args[1] as string) : BigInt(1)

    await mongoose.connect(connectionString, {
        autoIndex: true,
        autoCreate: true
    })
    const envHeight: bigint = defaultHeight

    const lastNotifiedBlock = await Block.findOne({
        status: BlockStatus.Success,
        network:  network,
        isNotified: true
    }).sort({number: 'desc'})

    let lastBlockHeight: bigint = lastNotifiedBlock == null ? envHeight : (BigInt(lastNotifiedBlock.number))
    console.log("Last Block Height: " + lastBlockHeight)

    while (true) {
        try {
            console.log("Start scan: " + lastBlockHeight)
            lastBlockHeight = await notify(subscriberUrl, lastBlockHeight, network)
            console.log("Sleep 3 seconds")
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (e) {
            console.log("Error: " + (e as Error).toString())
        }
    }
}

setImmediate(start)
