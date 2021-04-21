import { model, Schema, Document} from 'mongoose'
import {BlockStatus, Network} from "../enums/statuses";

export interface IBlock extends Document {
    hash: string,
    number: string,
    status: BlockStatus,
    network: Network
}

const schema = new Schema({
    _id: Schema.Types.ObjectId,
    hash: { type: String, required: true, index: true, unique: true },
    number: { type: String, required: true, index: true},
    status: Number,
    network: String
});
export const Block = model<IBlock>("block", schema)
