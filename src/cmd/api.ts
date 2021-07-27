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
})

module.exports = app;


/*
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';
import { Currency } from '../../src/models/enums/currency';
import { SubstrateAdaptor } from '../../src/adaptors/substrate';
import request from "supertest";

const app = require('../../src/cmd/api');
const mongoose = require('mongoose');
const modelBlock = require('../../src/models/db/block');
const modelEvent = require('../../src/models/db/event');
const modelTransaction = require('../../src/models/db/transactions');

jest.mock('@polkadot/api', () => ({
    ApiPromise: {
        api:jest.fn(),
        create: jest.fn(),
    },
    WsProvider: jest.fn(),
}));
jest.mock('../../src/adaptors/substrate', () => ({
    SubstrateAdaptor: {
        getInstance: jest.fn(),
    },
}));
jest.mock('../../src/adaptors/adaptor', () => ({
    Adaptor: {
        getBalance: jest.fn(),
        getLastHeight: jest.fn(),
    },
}));

beforeAll(async () => {
    await SubstrateAdaptor.getInstance.mockReturnValue({
        getBalance: jest.fn(() => 231),
        getLastHeight: jest.fn(() => 231n), 
    });
});
afterEach(() => {
    mongoose.connection.close();
});

const block1 = {
    hash: 'hash2',
    number: '126',
    status: BlockStatus.Success,
    network: Network.Polkadot,
    isNotified: false,
};    
const block2 = {
    hash: 'hash2',
    number: '126',
    status: BlockStatus.Pending,
    network: Network.Polkadot,
    isNotified: false,
};
const tx1 = {
    txId: 'txId',
    hash: 'hash',
    status: TxStatus.Success,
    block: block1,
};
const tx2 = {
    txId: 'txId2',
    hash: 'hash2',
    status: TxStatus.Success,
    block: block2,
};
const events = [
    {
        eventId: 'eventId',
        block: block1,
        transaction: tx1,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
    },
    {
        eventId: 'eventId2',
        block: block2,
        transaction: tx2,
        from: 'from1',
        to: 'to1',
        fee: 'fee1',
        value: 'value1',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
    },

];
const txs = [tx1, tx2];

it('test api 3', async () => {
    
    const response = await request(app).get('/substrate/balance/:address');
     expect(response.text).toBe("{\"value\":\"231\"}");
});

it('test api 1', async () => {
    const spyFind = jest.spyOn(modelTransaction.Transaction, 'find').mockReturnValueOnce({
        populate: jest.fn(() => ({
            sort: jest.fn(() => txs)
        })),
    });
    const response = await request(app).get('/transaction/:hash');

    expect(spyFind).toBeCalledTimes(1);
    expect(response.status).toBe(200);
});

it('test api 2', async () => {
    const spy = jest.spyOn(modelEvent.Event, 'find').mockReturnValueOnce({
        populate: jest.fn(() => ({
            populate: jest.fn(() => ({
                sort: jest.fn(() => ({
                    skip: jest.fn(() => ({
                        limit: jest.fn(() => events)
                    })),
                })),
            })),
        })),
    });

    const response = await request(app)
        .get('/transactions/:address')
        .query({
            page: '2',
            size: '1111'
        });
    expect(response.statusCode).toEqual(200)
    expect(spy).toBeCalledTimes(1);
    expect(response.text).toStrictEqual("[{\"id\":\"eventId\",\"hash\":\"hash\",\"currency\":0,\"to\":\"to\",\"from\":\"from\",\"value\":\"value\",\"fee\":\"fee\",\"timestamp\":12345,\"status\":1}]");
});

it('test api 4', async () => {    
    const spy = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    const response = await request(app).get('/status');

    expect(spy).toBeCalledTimes(4);
    expect(response.text).toBe("{\"polkadot\":{\"lastHeight\":\"244\",\"lastScannedHeight\":\"126\",\"lastNotifiedHeight\":\"126\"},\"kusama\":{\"lastHeight\":\"244\",\"lastScannedHeight\":\"126\",\"lastNotifiedHeight\":\"126\"}}");
});

*/