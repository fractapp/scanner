import { model, Schema, Document} from 'mongoose'
import {BlockStatus, Network} from "../enums/status";

export interface IBlock extends Document {
    hash: string,
    number: string,
    status: BlockStatus,
    network: Network,
    isNotified: boolean
}

const schema = new Schema({
    _id: Schema.Types.ObjectId,
    hash: { type: String, required: true, index: true, unique: true },
    number: { type: String, required: true, index: true},
    status: Number,
    network: String,
    isNotified: Boolean
});
export const Block = model<IBlock>("block", schema)
