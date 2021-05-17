import { Types, Schema, model, Document } from 'mongoose'
import {Block, IBlock} from "./block";
import {TxStatus} from "../enums/statuses";

export interface ITransaction extends Document {
    txId: string,
    hash: string,
    status: TxStatus,
    block: Types.ObjectId | IBlock,
}

const schema = new Schema({
    txId:  { type: String, required: true, unique: true },
    hash: String,
    status: Number,
    block: { type: Types.ObjectId, ref: Block, required: true }
});
export const Transaction = model<ITransaction>("transaction", schema)
