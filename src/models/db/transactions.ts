import { Types, Schema, model, Document } from 'mongoose'
import {Block, IBlock} from "./block";
import {TxStatus} from "../enums/status";

export interface ITransaction extends Document {
    txId: string,
    hash: string,
    status: TxStatus,
    error: string,
    block: Types.ObjectId | IBlock,
}

const schema = new Schema({
    txId:  { type: String, required: true, unique: true },
    hash: String,
    status: Number,
    error: String,
    block: { type: Types.ObjectId, ref: Block, required: true }
});
export const Transaction = model<ITransaction>("transaction", schema)
