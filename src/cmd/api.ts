import express, {NextFunction, Request, Response} from 'express';
import {Event, IEvent} from "../models/db/event";
import {Currency, toCurrency} from "../models/enums/currency";
import {TransactionRs, TxStatusRs} from '../models/response/transactions'
import mongoose from "mongoose";
import dotenv from "dotenv";
import {Block, IBlock} from "../models/db/block";
import {ITransaction, Transaction} from "../models/db/transactions";
import morgan from 'morgan'
import {BlockStatus, Network, TxAction, TxStatus} from "../models/enums/status";
import {SubstrateAdaptor} from "../adaptors/substrate";
import {Adaptor} from "../adaptors/adaptor";
import {ApiPromise} from "@polkadot/api";
import asyncHandler from 'express-async-handler';

const app = express()
dotenv.config()
app.use(morgan('combined'))

const maxPageSize = 1000
const defaultPageSize = 1000

const connectionString = process.env["MONGODB_CONNECTION"] as string
const host = process.env["HOST"] as string
const port = Number(process.env["PORT"] as string)
const sslFile = process.env["SSL"] as string

const apiByNetwork = new  Map<Network, Adaptor>()
mongoose.connect(connectionString, {
    autoIndex: true,
    autoCreate: true,
    tlsCertificateFile: sslFile == "" ? undefined : sslFile
}, async function () {
    apiByNetwork.set(Network.Polkadot, await SubstrateAdaptor.getInstance(process.env["POLKADOT_RPC_URL"] as string, Currency.DOT))
    apiByNetwork.set(Network.Kusama, await SubstrateAdaptor.getInstance(process.env["KUSAMA_RPC_URL"] as string, Currency.KSM))
    app.use(function(err: any, req: any, res: any, next: any) {
        console.error(err.stack);
        res.status(500).send();
    });
    app.listen(port, () => {
        console.log(`Example app listening at http://${host}:${port}`)
    })
})

app.get('/transaction/:hash', asyncHandler(async (req, res) => {
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
}))

app.get('/transactions/:address', asyncHandler(async (req, res) => {
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
            action: event.action == undefined ? TxAction.Transfer : event.action,
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
}))

app.get('/substrate/balance/:address', asyncHandler(async (req, res) => {
    const address: string = req.params.address
    const currency: Currency = req.query.currency == undefined ? Currency.DOT : toCurrency(req.query.currency as string)

    const api = apiByNetwork.get(currency == Currency.DOT ? Network.Polkadot : Network.Kusama)!
    const balance = await api.getBalance(address)

    return res.send({
        total: String(balance.total),
        transferable: String(balance.transferable),
        payableForFee: String(balance.payableForFee),
        staking: String(balance.staking)
    });
}))

app.get('/substrate/fee', asyncHandler(async (req, res) => {
    const hexTx: string = req.query.tx as string
    const network: Network = req.query.network == undefined ? Network.Polkadot : req.query.network as Network

    const api = apiByNetwork.get(network)!
    const baseApi: ApiPromise = api.getBaseApi()

    const info = await baseApi.rpc.payment.queryInfo(hexTx)

    return res.send({
        fee: info.partialFee.toBn().toString()
    });
}))


app.get('/substrate/transfer/fee', asyncHandler(async (req, res) => {
    const sender: string = req.query.sender as string
    const receiver: string = req.query.receiver as string
    const value: string = req.query.value as string
    const isFullBalance: string = req.query.isFullBalance as string
    const network: Network = req.query.network == undefined ? Network.Polkadot : req.query.network as Network

    const api = apiByNetwork.get(network)!
    const baseApi: ApiPromise = api.getBaseApi()

    const tx = isFullBalance ? await baseApi.tx.balances.transfer(receiver, value) : await baseApi.tx.balances.transferKeepAlive(receiver, value);
    const info = await tx.paymentInfo(sender)
    return res.send({
        fee: info.partialFee.toBn().toString()
    });
}))

app.get('/substrate/base', asyncHandler(async (req, res) => {
    const network: Network = req.query.network == undefined ? Network.Polkadot : req.query.network as Network

    const api = apiByNetwork.get(network)!
    const baseApi: ApiPromise = api.getBaseApi()

    const genesisHash = await baseApi.rpc.chain.getBlockHash(0)
    const metadataRpc = baseApi.runtimeMetadata
    const runtime  = baseApi.runtimeVersion

    return res.send({
        genesisHash: genesisHash.toHex(),
        metadata: metadataRpc.toHex(),
        specVersion: runtime.specVersion.toBn().toNumber(),
        transactionVersion: runtime.transactionVersion.toBn().toNumber(),
    });
}))

app.get('/substrate/txBase/:sender', asyncHandler(async (req, res) => {
    const sender: string = req.params.sender
    const network: Network = req.query.network == undefined ? Network.Polkadot : req.query.network as Network

    const api = apiByNetwork.get(network)!
    const baseApi: ApiPromise = api.getBaseApi()

    const blockHeader = await baseApi.rpc.chain.getHeader()
    const nonce = await baseApi.rpc.system.accountNextIndex(sender)

    return res.send({
        blockNumber: blockHeader.number.toNumber(),
        blockHash: blockHeader.hash.toHex(),
        nonce: nonce.toBn().toNumber(),
    });
}))

app.post('/substrate/broadcast', asyncHandler(async (req, res) => {
    const tx: string = req.query.tx as string
    const network: Network = req.query.network == undefined ? Network.Polkadot : req.query.network as Network

    const api = apiByNetwork.get(network)!
    const baseApi: ApiPromise = api.getBaseApi()
    const info = await baseApi.rpc.author.submitExtrinsic(baseApi.createType('Extrinsic', tx))

    return res.send({
        hash: info.toHex()
    });
}))

app.get('/status', asyncHandler(async (req, res, next) => {
    const polkadotApi = apiByNetwork.get(Network.Polkadot)!
    const kusamaApi = apiByNetwork.get(Network.Kusama)!

    const lastBlockPolkadot: IBlock | null = await Block.findOne({
        network: Network.Polkadot
    }).sort({number: 'desc'})

    const lastBlockKusama: IBlock | null = await Block.findOne({
        network: Network.Kusama
    }).sort({number: 'desc'})

    const lastNotifiedBlockPolkadot: IBlock | null = await Block.findOne({
        network: Network.Polkadot,
        isNotified: true
    }).sort({number: 'desc'})

    const lastNotifiedBlockKusama: IBlock | null = await Block.findOne({
        network: Network.Kusama,
        isNotified: true
    }).sort({number: 'desc'})

    return res.send({
        polkadot: {
            lastHeight: (await polkadotApi.getLastHeight()).toString(),
            lastScannedHeight: lastBlockPolkadot?.number.toString() ?? "0",
            lastNotifiedHeight: lastNotifiedBlockPolkadot?.number.toString() ?? "0",
        },
        kusama: {
            lastHeight: (await kusamaApi.getLastHeight()).toString(),
            lastScannedHeight: lastBlockKusama?.number.toString() ?? "0",
            lastNotifiedHeight: lastNotifiedBlockKusama?.number.toString() ?? "0",
        }
    });
}))
