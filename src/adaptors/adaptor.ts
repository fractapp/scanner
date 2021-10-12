import {Currency} from "../models/enums/currency";
import {TxAction, TxStatus} from "../models/enums/status";
import {Transaction} from "../models/db/transactions";

export interface Adaptor {
    getBaseApi(): any

    getCurrency(): Currency,

    getLastHeight(): Promise<bigint>

    getLastFinalizedHeight(): Promise<bigint>

    getBlock(height: bigint): Promise<Block>

    getTxsAndEvents(hash: string): Promise<Array<TxAndEvents>>

    getBalance(address: string): Promise<Balance>
}

export type Balance = {
    total: bigint,
    transferable: bigint,
    payableForFee: bigint,
    staking: bigint
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
    error: string
}

export type Event = {
    id: string,
    from: string,
    to: string,
    value: string,
    fee: string
    action: TxAction
}
