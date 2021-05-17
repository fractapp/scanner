import {Currency} from "../models/enums/currency";
import {TxStatus} from "../models/enums/statuses";
import {Transaction} from "../models/db/transactions";

export interface Adaptor {
    getCurrency(): Currency,

    getLastHeight(): Promise<bigint>

    getLastFinalizedHeight(): Promise<bigint>

    getBlock(height: bigint): Promise<Block>

    getTxsAndEvents(hash: string): Promise<Array<TxAndEvents>>

    getBalance(address: string): Promise<bigint>
}

export type Block = {
    height: bigint
    hash: string
    timestamp: number
}

export type TxAndEvents = {
    transaction: Transaction,
    events: Array<Event>
}

export type Transaction = {
    id: string,
    hash: string,
    status: TxStatus,
}

export type Event = {
    id: string,
    from: string,
    to: string,
    value: string,
    fee: string
}
