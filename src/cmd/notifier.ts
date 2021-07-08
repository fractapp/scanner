import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {BlockStatus, Network, TxStatus} from "../models/enums/statuses";
import {Block, IBlock} from "../models/db/block";
import axios from 'axios'

dotenv.config()

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
            lastBlockHeight = await scan(subscriberUrl, lastBlockHeight, network)
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
        network: network,
        isNotified: false
    }).sort({number: 'desc'})

    if (lastBlock == null || BigInt(lastBlock.number) < lastNotifiedHeight) {
        return lastNotifiedHeight
    }

    for (let blockNumber = lastNotifiedHeight+BigInt(1); blockNumber <= BigInt(lastBlock.number); blockNumber++) {
        const block: IBlock | null = await Block.findOne({
            status: BlockStatus.Success,
            number: String(blockNumber)
        })

        if (block == null || block.isNotified) {
            console.log("Skip block: " + blockNumber)
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

        if (hasFailNotification) {
            blockNumber--
            continue
        }

        block.isNotified = true
        await block.save()
    }

    return BigInt(lastBlock.number)
}

setImmediate(start)
