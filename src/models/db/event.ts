import { Types, Schema, model, Document } from 'mongoose'
import {Block, IBlock} from "./block";
import {Currency} from "../enums/currency";
import {ITransaction, Transaction} from "./transactions";
import {BlockStatus} from "../enums/statuses";

export interface IEvent extends Document {
    eventId: string,
    hash: string,
    block: Types.ObjectId | IBlock,
    transaction: Types.ObjectId | ITransaction,
    index: number,
    from: string,
    to: string,
    fee: string,
    value: string,
    timestamp: number,
    currency: Currency,
    blockStatus: BlockStatus,
    isNotified: boolean
}

const schema = new Schema({
    eventId: { type: String, required: true, index: true, unique: true },
    hash:  { type: String, required: true },
    block: { type: Types.ObjectId, ref: Block, required: true },
    transaction: { type: Types.ObjectId, ref: Transaction, required: true },
    from: String,
    to: String,
    fee: String,
    value: String,
    timestamp: Number,
    currency: Number,
    blockStatus: Number,
    isNotified: Boolean
});
export const Event = model<IEvent>("event", schema)
