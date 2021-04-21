import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {BlockStatus, Network, TxStatus} from "../models/enums/statuses";
import {Block, IBlock} from "../models/db/block";
import axios from 'axios'

dotenv.config()

// TODO
let isShutDown = false
async function kill() {
    console.log("\n--------------------");
    console.log("Start notifier shutdown...");
    console.log("--------------------");
    isShutDown = true
}
process.on('SIGINT', kill);
process.on('SIGTERM', kill);

const args = process.argv.slice(2);

const start = async () => {
    const connectionString = process.env["MONGODB_CONNECTION"] as string
    const subscriberUrl = process.env["SUBSCRIBER_URL"] as string
    const network =  args[0] as Network
    const defaultHeight = args[1] != "" ? BigInt(args[1] as string) : BigInt(1)

    await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: true,
        useCreateIndex: true
    })
    const envHeight: bigint = defaultHeight

    const lastNotifiedEvent = await Event.findOne({
        blockStatus: BlockStatus.Success,
        currency:  getNativeCurrency(network),
        isNotified: true
    }).sort({number: 'desc'}).populate('block')


    let lastBlockHeight: bigint = lastNotifiedEvent == null ? envHeight : BigInt((lastNotifiedEvent.block as IBlock).number)
    if (envHeight > lastBlockHeight) {
        lastBlockHeight = envHeight
    }

    while (true) {
        try {
            lastBlockHeight = await scan(subscriberUrl, lastBlockHeight, network)

            if (isShutDown) {
                console.log("--------------------");
                console.log("Notifier shutdown");
                console.log("--------------------");
                process.exit()
                return
            }

            console.log("Sleep 3 seconds")
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (e) {
            console.log("Error: " + e.toString())
        }
    }
}

async function scan(subscriberUrl: string, lastNotifiedHeight: bigint, network: Network): Promise<bigint> {
    const lastBlock: IBlock | null = await Block.findOne({
        status: BlockStatus.Success,
        network: network
    }).sort({number: 'desc'})

    if (lastBlock == null) {
        return lastNotifiedHeight
    }

    for (let blockNumber = lastNotifiedHeight; blockNumber <= BigInt(lastBlock.number); blockNumber++) {
        const block: IBlock | null = await Block.findOne({
            status: BlockStatus.Success,
            number: String(blockNumber)
        })

        if (block == null) {
            continue
        }

        console.log("Block id: " + block._id)
        console.log("Block number: " + block.number)
        console.log("Block hash: " + block.hash)

        const events = await Event.find({
            currency: getNativeCurrency(network),
            block: block._id,
            isNotified: false
        }).populate('transaction')

        let hasFailNotification = false
        for (let e of events) {
            if ((e.transaction as ITransaction).status == TxStatus.Fail) {
                continue
            }

            console.log("Start notification: " + e.eventId)
            let isSuccess = false
            try {
                const rs = await axios.post(`${subscriberUrl}/notify`,
                    {
                        from: e.from,
                        to: e.to,
                        value: e.value,
                        currency: e.currency
                    })
                isSuccess = rs.status == 200
            } catch (e) {
            }

            if (isSuccess) {
                e.isNotified = true
                await e.save()
                console.log("Success: " + e.eventId)
            } else if (!hasFailNotification) {
                hasFailNotification = true
                console.log("Fail: " + e.eventId)
            }
        }

        if (isShutDown) {
            return blockNumber
        }

        if (hasFailNotification) {
            blockNumber--
            continue
        }
    }

    return BigInt(lastBlock.number)
}

setImmediate(start)
