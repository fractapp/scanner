import express from 'express';
import {Event, IEvent} from "../models/db/event";
import {Currency, toCurrency} from "../models/enums/currency";
import {TransactionRs, TxStatusRs} from '../models/response/transactions'
import mongoose from "mongoose";
import dotenv from "dotenv";
import {Block, IBlock} from "../models/db/block";
import {ITransaction, Transaction} from "../models/db/transactions";
import morgan from 'morgan'
import {BlockStatus, Network, TxStatus} from "../models/enums/statuses";
import {SubstrateAdaptor} from "../adaptors/substrate";
import {Adaptor} from "../adaptors/adaptor";

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

app.get('/transaction/:hash', async (req, res) => {
    const hash = req.params.hash
    let txs: Array<ITransaction> = await Transaction.find({
        hash: hash
    }).populate('block').sort({ number: "desc"})

    txs = txs.filter((t) => t.block != undefined && (t.block as IBlock).status != BlockStatus.Forked)

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

app.get('/transactions/:address', async (req, res) => {
    const txs: Array<TransactionRs> = []

    const address = req.params.address
    const page = req.query.page == undefined ? 0 : Number(req.query.page)
    const currency: Currency = req.query.currency == undefined ? Currency.DOT : toCurrency(req.query.currency as string)

    let size = req.query.size == undefined ? defaultPageSize : Number(req.query.size)
    if (size > maxPageSize) {
        size = maxPageSize
    }

    const dbEvents: Array<IEvent> = await Event.find({
        currency: currency,
        $or: [{from: address}, {to: address}]
    }).populate('transaction').populate('block').sort({timestamp: 'desc'}).skip(size * page).limit(size) //TODO: fix pages

    for (const event of dbEvents) {
        if ((event.block as IBlock).status != BlockStatus.Success) {
            continue
        }

        txs.push({
            id: event.eventId,
            hash: (event.transaction as ITransaction).hash,
            currency: event.currency,
            to: event.to,
            from: event.from,
            value: event.value,
            fee: event.fee,
            timestamp: event.timestamp,
            status: (event.transaction as ITransaction).status == TxStatus.Success ? TxStatusRs.Success : TxStatusRs.Fail
        })
    }
    return res.send(txs);
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

app.get('/status', async (req, res) => {
    const polkadotApi = apiByCurrency.get(Currency.DOT)!
    const kusamaApi = apiByCurrency.get(Currency.KSM)!

    const lastBlockPolkadot: IBlock | null = await Block.findOne({
        network: Network.Polkadot
    }).sort({number: 'desc'})

    const lastBlockKusama: IBlock | null = await Block.findOne({
        network: Network.Kusama
    }).sort({number: 'desc'})

    return res.send({
        polkadot: {
            lastHeight: (await polkadotApi.getLastHeight()).toString(),
            lastScannedHeight: lastBlockPolkadot?.number.toString() ?? "0",
        },
        kusama: {
            lastHeight: (await kusamaApi.getLastHeight()).toString(),
            lastScannedHeight: lastBlockKusama?.number.toString() ?? "0"
        }
    });
})
