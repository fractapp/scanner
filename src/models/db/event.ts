import { Types, Schema, model, Document } from 'mongoose'
import {Block, IBlock} from "./block";
import {Currency} from "../enums/currency";
import {ITransaction, Transaction} from "./transactions";
import {TxAction} from "../enums/status";

export interface IEvent extends Document {
    eventId: string,
    block: Types.ObjectId | IBlock,
    transaction: Types.ObjectId | ITransaction,
    action: TxAction,
    from: string,
    to: string,
    fee: string,
    value: string,
    timestamp: number,
    currency: Currency,
    isNotified: boolean
}

const schema = new Schema({
    eventId: { type: String, required: true, index: true, unique: true },
    block: { type: Types.ObjectId, ref: Block, required: true },
    transaction: { type: Types.ObjectId, ref: Transaction, required: true },
    action: Number,
    from: String,
    to: String,
    fee: String,
    value: String,
    timestamp: Number,
    currency: Number,
    isNotified: Boolean
});
export const Event = model<IEvent>("event", schema)
