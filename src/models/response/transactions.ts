import {Currency} from "../enums/currency";

export enum TxStatusRs {
    Pending,
    Success,
    Fail
}
export type TransactionRs = {
    id: string,
    from: string,
    to: string,
    fee: string,
    value: string,
    timestamp: number,
    currency: Currency,
    status: TxStatusRs
}

