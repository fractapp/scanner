import {BlockStatus, Network, TxAction, TxStatus} from "../models/enums/status";
import {Block, IBlock} from "../models/db/block";
import {Event} from "../models/db/event";
import {getNativeCurrency} from "../models/enums/currency";
import {ITransaction} from "../models/db/transactions";
import axios from "axios";
import {TxStatusRs} from "../models/response/transactions";

export async function notify(subscriberUrl: string, lastNotifiedHeight: bigint, network: Network): Promise<bigint> {
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
            number: Number(blockNumber)
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
        const txs = []
        for (let event of events) {
            txs.push({
                id: event.eventId,
                action: event.action == undefined ? TxAction.Transfer : event.action,
                hash: (event.transaction as ITransaction).hash,
                currency: event.currency,
                to: event.to,
                from: event.from,
                value: event.value,
                fee: event.fee,
                timestamp: event.timestamp,
                status: (event.transaction as ITransaction).status == TxStatus.Success ? TxStatusRs.Success : TxStatusRs.Fail
            })
        }

        let isSuccess = false
        if (txs.length > 0) {
            try {
                const rs = await axios.post(`${subscriberUrl}/notify`, txs)
                isSuccess = rs.status == 200
            } catch (e) {
            }

            if (isSuccess) {
                console.log("Success")
            } else if (!hasFailNotification) {
                blockNumber--
                continue
            }
        }

        block.isNotified = true
        await block.save()
    }

    return BigInt(lastBlock.number)
}
