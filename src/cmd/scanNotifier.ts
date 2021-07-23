import {Event, IEvent} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction, Transaction} from "../models/db/transactions";
import {BlockStatus, Network, TxStatus} from "../models/enums/statuses";
import {Block, IBlock} from "../models/db/block";
import axios from 'axios'

export async function scan(subscriberUrl: string, lastNotifiedHeight: bigint, network: Network): Promise<bigint> {
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
