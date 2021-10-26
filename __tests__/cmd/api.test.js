import {BlockStatus, Network, TxAction, TxStatus} from '../../src/models/enums/status';
import { Currency } from '../../src/models/enums/currency';
import { SubstrateAdaptor } from '../../src/adaptors/substrate';
import request from "supertest";
import mongoose from 'mongoose';
import { app, server } from '../../src/cmd/api';
import { Block } from '../../src/models/db/block';
import { Event } from '../../src/models/db/event';
import { Transaction } from '../../src/models/db/transactions';

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

beforeAll(() => {
    SubstrateAdaptor.getInstance.mockReturnValue({
        getBaseApi: jest.fn(() => ({
            rpc: {
                chain: {
                    getBlockHash: (number) => ({
                        toHex: jest.fn(() => "blockHash" + number)
                    })
                }
            },
            runtimeMetadata: {
                toHex: jest.fn(() => "runtimeMetadata")
            },
            runtimeVersion: {
                specVersion: {
                    toBn: jest.fn(() => ({
                        toNumber: jest.fn(() => 1000)
                    }))
                },
                transactionVersion: {
                    toBn: jest.fn(() => ({
                        toNumber: jest.fn(() => 3000)
                    }))
                }
            }
        })),
        getBalance: () => ({
            total: 10000n,
            transferable: 20000n,
            payableForFee: 30000n,
            staking: 40000n
        }),
        getLastHeight: jest.fn(() => 231n),
    });
});
afterAll(() => {
    server?.close()
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

it('test api transaction/:hash', async () => {
    const spyFind = jest.spyOn(Transaction, 'find').mockReturnValueOnce({
        populate: jest.fn(() => ({
            sort: jest.fn(() => txs)
        })),
    });
    const response = await request(app).get('/transaction/:hash');

    expect(spyFind).toBeCalledTimes(1);
    expect(JSON.parse(response.text)).toStrictEqual({
        status: 1
    });
});

it('test api transactions/:address', async () => {
    const spy = jest.spyOn(Event, 'find').mockReturnValueOnce({
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

    expect(JSON.parse(response.text)).toStrictEqual([
        {
            action: TxAction.Transfer,
            id: "eventId",
            hash: "hash",
            currency: 0,
            to: "to",
            from: "from",
            value: "value",
            fee: "fee",
            timestamp: 12345,
            status: 1
        }
    ]);
});

it('test api substrate/balance/:address', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const response = await request(app).get('/substrate/balance/:address').query({
        currency: 'DOT',
    });
    console.log(response.text)
    expect(JSON.parse(response.text)).toStrictEqual({
        total: "10000",
        transferable: "20000",
        payableForFee: "30000",
        staking: "40000"
    });
});

it('test api status', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    const spy = jest.spyOn(Block, 'findOne');
    jest.spyOn(Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    jest.spyOn(Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block1)
    });
    const response = await request(app).get('/status');

    expect(spy).toBeCalledTimes(4);
    expect(JSON.parse(response.text)).toStrictEqual({
        polkadot: {
            lastHeight: "231",
            lastScannedHeight: "126",
            lastNotifiedHeight: "126"
        },
        kusama: {
            lastHeight: "231",
            lastScannedHeight: "126",
            lastNotifiedHeight: "126"
        }
    })
});

it('test api substrate/base', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await request(app).get('/substrate/base');

    expect(JSON.parse(response.text)).toStrictEqual({
        genesisHash: "blockHash0",
        metadata: "runtimeMetadata",
        specVersion: 1000,
        transactionVersion: 3000
    })
});

