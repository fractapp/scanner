import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {Adaptor, TxAndEvents} from "../adaptors/adaptor";
import {BlockStatus, Network} from "../models/enums/status";
import {Block, IBlock} from "../models/db/block";
import {SubstrateAdaptor} from "../adaptors/substrate";

export async function scan(fromHeight: bigint, toHeight: bigint, network: Network, adaptor: Adaptor) {
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
                number: Number(blockNumber),
                network: network
            }, {status: BlockStatus.Forked})

            await Block.updateOne({
                hash: blockInfo.hash,
                number: Number(blockNumber),
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
            number: Number(blockNumber),
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
                error: txAndEvents.transaction.error,
                block: newBlock._id,
            })
            transactions.push(tx)
            console.log("Tx found: " + tx.hash)

            for(let event of txAndEvents.events) {
                events.push(new Event({
                    eventId: event.id,
                    block: newBlock._id,
                    transaction: tx._id,
                    action: event.action,
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

export async function scanBlock(blockNumber: bigint, network: Network, adaptor: Adaptor): Promise<{
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
