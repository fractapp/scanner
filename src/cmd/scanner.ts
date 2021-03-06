import mongoose from 'mongoose'
import dotenv from "dotenv";
import {Event} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {Transaction} from "../models/db/transactions";
import {Adaptor} from "../adaptors/adaptor";
import {BlockStatus, Network} from "../models/enums/status";
import {Block, IBlock} from "../models/db/block";
import {SubstrateAdaptor} from "../adaptors/substrate";
import {scan} from "../scanner/scanner";

dotenv.config()

const args = process.argv.slice(2);
const scanCount = BigInt(100)

const start = async () => {
    const connectionString = process.env["MONGODB_CONNECTION"] as string

    await mongoose.connect(connectionString, {
        autoIndex: true,
        autoCreate: true,
    })

    const network =  args[0] as Network
    const defaultHeight = args[1] != undefined && args[1].trim() != "" ? BigInt(args[1] as string) : BigInt(1)

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
            console.log("Error: " + (e as Error).toString())
            process.exit(1)
        }
    }
}

setImmediate(start)
