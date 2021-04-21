import express from 'express';
import {Event, IEvent} from "../models/db/event";
import {Currency, toCurrency} from "../models/enums/currency";
import {TransactionRs, TxStatusRs} from '../models/response/transactions'
import mongoose from "mongoose";
import dotenv from "dotenv";
import {IBlock} from "../models/db/block";
import {ITransaction, Transaction} from "../models/db/transactions";
import morgan from 'morgan'
import {BlockStatus, TxStatus} from "../models/enums/statuses";
import {SubstrateAdaptor} from "../adaptors/substrate";
import {Adaptor} from "../adaptors/adaptor";
import {Keyring} from '@polkadot/keyring';
import {ApiPromise, WsProvider} from '@polkadot/api';

const app = express()
dotenv.config()
app.use(morgan('combined'))

const maxPageSize = 1000
const defaultPageSize = 1000

const connectionString = process.env["MONGODB_CONNECTION"] as string
const host = process.env["HOST"] as string
const port = Number(process.env["PORT"] as string)

const apiByCurrency = new  Map<Currency, Adaptor>()

mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: true,
    useCreateIndex: true
}, async function () {

    apiByCurrency.set(Currency.DOT, await SubstrateAdaptor.getInstance(process.env["POLKADOT_RPC_URL"] as string, Currency.DOT))
    apiByCurrency.set(Currency.KSM, await SubstrateAdaptor.getInstance(process.env["KUSAMA_RPC_URL"] as string, Currency.KSM))

    app.use(function(err: any, req: any, res: any, next: any) {
        console.error(err.stack);
        res.status(500).send();
    });
    app.listen(port, () => {
        console.log(`Example app listening at http://${host}:${port}`)
    })
})

app.get('/transactions/:address', async (req, res) => {
    const txs: Array<TransactionRs> = []

    const address = req.params.address
    const page = req.query.page == undefined ? 0 : Number(req.query.page)
    const currency: Currency = req.query.currency == undefined ? Currency.DOT : toCurrency(req.query.currency as string)

    let size = req.query.size == undefined ? defaultPageSize : Number(req.query.size)
    if (size > maxPageSize) {
        size = maxPageSize
    }

    const dbTxs: Array<IEvent> = await Event.find({
        currency: currency,
        $or: [{from: address}, {to: address}],
        blockStatus: BlockStatus.Success
    }).populate('transaction').sort({timestamp: 'desc'}).skip(size * page).limit(size)

    for (const tx of dbTxs) {
        txs.push({
            id: tx.eventId,
            currency: tx.currency,
            to: tx.to,
            from: tx.from,
            value: tx.value,
            fee: tx.fee,
            timestamp: tx.timestamp,
            status: (tx.transaction as ITransaction).status == TxStatus.Success ? TxStatusRs.Success : TxStatusRs.Fail
        })
    }
    return res.send(txs);
})

app.get('/transaction/:hash', async (req, res) => {
    const hash = req.params.hash

    let txs: Array<ITransaction> = await Transaction.find({
        hash: hash
    }).populate('block')

    txs = txs.filter((t) => t.block != undefined && (t.block as IBlock).status != BlockStatus.Forked)
        .sort((a, b) => Number(BigInt((b.block as IBlock).number) - BigInt((a.block as IBlock).number)))

    let status = TxStatusRs.Pending
    if (txs.length != 0) {
        const tx = txs[0]
        if ((tx.block as IBlock).status == BlockStatus.Success) {
            status = tx.status == TxStatus.Success ? TxStatusRs.Success : TxStatusRs.Fail
        }
    }

    return res.send({
        status: status
    });
})

app.get('/substrate/balance/:address', async (req, res) => {
    const address = req.params.address
    const currency: Currency = req.query.currency == undefined ? Currency.DOT : toCurrency(req.query.currency as string)

    const api = apiByCurrency.get(currency)!
    const balance = await api.getBalance(address)

    return res.send({
        value: String(balance)
    });
})


