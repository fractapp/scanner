import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {Adaptor, TxAndEvents} from "../adaptors/adaptor";
import {BlockStatus, Network} from "../models/enums/statuses";
import {Block, IBlock} from "../models/db/block";
import {SubstrateAdaptor} from "../adaptors/substrate";

dotenv.config()

const args = process.argv.slice(2);

const start = async () => {
    const connectionString = process.env["MONGODB_CONNECTION"] as string

    const network =  args[0] as Network
    const defaultHeight = args[1] != undefined && args[1].trim() != "" ? BigInt(args[1] as string) : BigInt(1)
    const scanCount =  args[2] != undefined && args[2].trim() != "" ? BigInt(args[2] as string) : BigInt(100)

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
        autoIndex: true,
        autoCreate: true
    })
    const envHeight: bigint = BigInt(defaultHeight)

    const lastBlock: IBlock | null = await Block.findOne({status: BlockStatus.Success, network: network }).sort({ number: 'desc' })
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
            const lastSuccessBlock: IBlock | null = await Block.findOne({status: BlockStatus.Success, network: network }).sort({ number: 'desc' })
            const lastPendingBlock: IBlock | null = await Block.findOne({status: BlockStatus.Pending, network: network }).sort({ number: 'desc' })

            const startHeight = lastSuccessBlock == null ? envHeight : (BigInt(lastSuccessBlock?.number) + BigInt(1))
            let toHeight = await adaptor.getLastHeight()

            if (lastPendingBlock != null && BigInt(lastPendingBlock.number) >= toHeight) {
                console.log("Sleep 3 seconds")
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            if (toHeight-scanCount > startHeight) {
                toHeight = startHeight + scanCount
            }
            await scan(startHeight, toHeight, network, adaptor)
        } catch (e) {
            console.log("Error: " + (e instanceof Error).toString())
            process.exit(1)
        }
    }
}

async function scan(fromHeight: bigint, toHeight: bigint, network: Network, adaptor: Adaptor) {
    const lastFinalizedHeight = await adaptor.getLastFinalizedHeight()

    const blocks = new Map<bigint, {
        isExistInDb: boolean,
        timestamp: number,
        hash: string,
    }>()
    const txsAndEventsByBlock = new Map<bigint, Array<TxAndEvents>>()

    const asyncFunctions = new Map<bigint, Promise<void>>()
    for (let blockNumber = fromHeight; blockNumber <= toHeight; blockNumber++) {
        asyncFunctions.set(blockNumber, (
            async () => {
                const info = await scanBlock(blockNumber, network, adaptor)
                blocks.set(blockNumber, { isExistInDb: info.isExistInDb, hash: info.hash, timestamp: info.timestamp })
                txsAndEventsByBlock.set(blockNumber, info.txAndEvents)
            }
        )())
    }

   for (let blockNumber = fromHeight; blockNumber <= toHeight; blockNumber++) {
        await asyncFunctions.get(blockNumber)!
        const blockInfo = blocks.get(blockNumber)!
        const txsAndEvents = txsAndEventsByBlock.get(blockNumber)!

       console.log("Block number: " + blockNumber)
       console.log("Block hash: " + blockInfo.hash)

        if (blockInfo.isExistInDb && lastFinalizedHeight >= blockNumber) {
            await Block.updateMany({
                hash: {
                    $ne: blockInfo.hash
                },
                number: String(blockNumber),
                network: network
            }, {status: BlockStatus.Forked})

            await Block.updateOne({
                hash: blockInfo.hash,
                number: String(blockNumber),
                network: network
            }, {status: BlockStatus.Success})

            console.log("block is confirmed")
        }

       if (blockInfo.isExistInDb) {
           continue
       }

        const newBlock: IBlock = new Block({
            _id: new mongoose.Types.ObjectId(),
            hash: blockInfo.hash,
            number: blockNumber,
            status: lastFinalizedHeight >= blockNumber ? BlockStatus.Success : BlockStatus.Pending,
            network: network,
            isNotified: false,
        })

        const events: Array<IEvent> = []
        const transactions: Array<ITransaction> = []

        for(let txAndEvents of txsAndEvents) {
            const tx = new Transaction({
                _id: new mongoose.Types.ObjectId(),
                txId: txAndEvents.transaction.id,
                hash: txAndEvents.transaction.hash,
                status: txAndEvents.transaction.status,
                block: newBlock._id,
            })
            transactions.push(tx)
            console.log("Tx found: " + tx.hash)

            for(let event of txAndEvents.events) {
                events.push(new Event({
                    eventId: event.id,
                    block: newBlock._id,
                    transaction: tx._id,
                    from: event.from,
                    to: event.to,
                    fee: String(event.fee),
                    value: event.value,
                    timestamp: blockInfo.timestamp,
                    currency: adaptor.getCurrency(),
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
}

async function scanBlock(blockNumber: bigint, network: Network, adaptor: Adaptor): Promise<{
    isExistInDb: boolean,
    hash: string,
    timestamp: number,
    txAndEvents: Array<TxAndEvents>
}> {
    const block = await adaptor.getBlock(blockNumber)

    const dbBlock: IBlock | null = await Block.findOne({ hash: block.hash, network: network })

    if (dbBlock != null) {
        return  {isExistInDb: true, hash: block.hash, timestamp: block.timestamp, txAndEvents: []}
    }

    const txsAndEvents = await adaptor.getTxsAndEvents(block.hash)
    return {
        isExistInDb: false,
        hash: block.hash,
        timestamp: block.timestamp,
        txAndEvents: txsAndEvents
    }
}
setImmediate(start)
