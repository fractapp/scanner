import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {Adaptor} from "../adaptors/adaptor";
import {BlockStatus, Network} from "../models/enums/statuses";
import {Block, IBlock} from "../models/db/block";
import {SubstrateAdaptor} from "../adaptors/substrate";

dotenv.config()

const args = process.argv.slice(2);

const start = async () => {
    const connectionString = process.env["MONGODB_CONNECTION"] as string
    const network =  args[0] as Network
    const defaultHeight = args[1].trim() != "" ? BigInt(args[1] as string) : BigInt(1)

    const currency = getNativeCurrency(network)
    let adaptor: Adaptor
    switch (network) {
        case Network.Polkadot:
            adaptor = await SubstrateAdaptor.getInstance(process.env["POLKADOT_RPC_URL"] as string, currency)
            break
        case Network.Kusama:
            adaptor = await SubstrateAdaptor.getInstance(process.env["KUSAMA_RPC_URL"] as string, currency)
            break
        default:
            throw ("invalid network type")
    }

    await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: true,
        useCreateIndex: true
    })
    const envHeight: bigint = BigInt(defaultHeight)

    const lastBlock: IBlock | null = await Block.findOne({status: BlockStatus.Success, network: network }).sort({ number: 'desc' })

    let lastBlockHeight: bigint = lastBlock == null ? envHeight : BigInt(lastBlock?.number)
    if (lastBlock != null) {
        const blockForRemoving: Array<IBlock> = await Block.find({ number: { $gte: lastBlock.number }, network: network })

        for (let block of blockForRemoving) {
            await Transaction.find({ block: block._id }).deleteMany()
            await Event.find({ block: block._id }).deleteMany()
        }

        await Block.find({ number: { $gte: lastBlock.number }, network: network }).deleteMany()
    }

    while (true) {
        try {
            lastBlockHeight = await scan(lastBlockHeight, network, adaptor)

            console.log("Sleep 5 seconds")
            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (e) {
            console.log("Error: " + e.toString())
            process.exit(1)
        }
    }
}

async function scan(lastScannedHeight: bigint, network: Network, adaptor: Adaptor): Promise<bigint> {
    const lastFinalizedHeight = await adaptor.getLastFinalizedHeight()
    const lastNotFinalizedHeight = await adaptor.getLastHeight()

    for (let blockNumber = lastScannedHeight; blockNumber <= lastNotFinalizedHeight; blockNumber++) {
        const block = await adaptor.getBlock(blockNumber)

        console.log("Block number: " + block.height)
        console.log("Block hash: " + block.hash)

        // get pending or success block
        const dbBlock: IBlock | null = await Block.findOne({number: String(block.height), network: network, status: { $ne: BlockStatus.Forked } })

        if (dbBlock != null && lastFinalizedHeight >= block.height) {
            if (dbBlock.hash != block.hash) {
                await Event.updateMany({block: dbBlock._id }, { blockStatus: BlockStatus.Forked })
                dbBlock.status = BlockStatus.Forked
                await dbBlock.save()

                console.log("block is forked")

                // return to find valid fork
                blockNumber--
                continue
            } else if (dbBlock.status == BlockStatus.Pending) {
                await Event.updateMany({block: dbBlock._id}, {blockStatus: BlockStatus.Success})
                dbBlock.status = BlockStatus.Success
                await dbBlock.save()

                // drop all forks
                await Block.updateMany(
                    {
                        _id: {
                            $ne: dbBlock._id
                        },
                        number: String(block.height),
                        network: network
                    },
                    {
                        status: BlockStatus.Forked
                    })
                console.log("block is confirmed")
            }

            continue
        }

        if (dbBlock != null) {
            continue
        }

        const newBlock: IBlock = new Block({
            _id: new mongoose.Types.ObjectId(),
            hash: block.hash,
            number: block.height,
            status: lastFinalizedHeight >= block.height ? BlockStatus.Success : BlockStatus.Pending,
            network: network,
        })

        const txsAndEvents = await adaptor.getTxsAndEvents(block.hash)

        const events: Array<IEvent> = []
        const transactions: Array<ITransaction> = []

        for(let txAndEvents of txsAndEvents) {
            const tx = new Transaction({
                _id: new mongoose.Types.ObjectId(),
                hash: txAndEvents.transaction.hash,
                block: newBlock._id,
                status: txAndEvents.transaction.status
            })
            transactions.push(tx)
            console.log("Tx found: " + tx.hash)

            for(let event of txAndEvents.events) {
                events.push(new Event({
                    eventId: event.id,
                    hash: event.hash,
                    block: newBlock._id,
                    transaction: tx._id,
                    fee: String(event.fee),
                    from: event.from,
                    to: event.to,
                    value: event.value,
                    currency: adaptor.getCurrency(),
                    timestamp: block.timestamp,
                    blockStatus: newBlock.status,
                    isNotified: false
                }))
                console.log("Event found: " + event.id)
            }
        }

        await Block.create(newBlock)
        await Transaction.create(transactions)
        await Event.create(events)
        console.log(`add new block (Status: ${newBlock.status})`)
    }

    return lastFinalizedHeight
}

setImmediate(start)
