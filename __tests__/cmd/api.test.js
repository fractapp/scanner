import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';
import { Currency } from '../../src/models/enums/currency';
import { SubstrateAdaptor } from '../../src/adaptors/substrate';

const app = require('../../src/cmd/api')
const supertest = require('supertest')
const request = supertest(app)
const mongoose = require('mongoose');
const mockingoose = require('mockingoose');
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
}));/*
jest.mock('mongoose', () => ({
    ...jest.requireActual('mongoose'),
    find: jest.fn(() => ({
        populate: jest.fn(),
        sort: jest.fn(),
    })),
}));*/
jest.mock('../../src/adaptors/adaptor', () => ({
    Adaptor: {
        getBalance: jest.fn(),
        getLastHeight: jest.fn(),
    },
}));

beforeAll(async function() {
    await SubstrateAdaptor.getInstance.mockReturnValue({
        getBalance: jest.fn(() => 231),
        getLastHeight: jest.fn(() => 231n), 
    });
});
it('test api 1', async () => {
    const block1 = await modelBlock.Block.create(
        {
            _id: mongoose.Types.ObjectId(),
            hash: 'hash1',
            number: '125',
            status: BlockStatus.Success,
            network: Network.Polkadot,
            isNotified: false,
        }
    )
    const block2 = await modelBlock.Block.create(
        {
            _id: mongoose.Types.ObjectId(),
            hash: 'hash2',
            number: '126',
            status: BlockStatus.Forked,
            network: Network.Polkadot,
            isNotified: false,
        }
    )
    const tx1 = await modelTransaction.Transaction.create(
        {
            txId: 'txId',
            hash: 'hash',
            status: TxStatus.Success,
            block: block1,
        }
    );
    const tx2 = await modelTransaction.Transaction.create(
        {
            txId: 'txId',
            hash: 'hash',
            status: TxStatus.Success,
            block: block2,
        }
    );
    const txs = [tx1, tx2];
    const spy = jest.spyOn(modelTransaction.Transaction, 'find');
    jest.spyOn(modelEvent.Event, 'find').mockReturnValue(txs);

    const response = await request.get('/transaction/:hash');

    expect(spy).toBeCalledTimes(1);
    expect(response.status).toBe(200);
});

it('test api 2', async () => {
    const block = await modelBlock.Block.create(
        {
            _id: mongoose.Types.ObjectId(),
            hash: 'hash2',
            number: '126',
            status: BlockStatus.Success,
            network: Network.Polkadot,
            isNotified: false,
        }
    )
    const tx = await modelTransaction.Transaction.create(
        {
            txId: 'txId',
            hash: 'hash',
            status: TxStatus.Success,
            block: block,
        }
    );
    const event = {
        eventId: 'eventId',
        block: block,
        transaction: tx,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
    };
    const req = {
        address: 'address',
        page: 2,
        currency: Currency.DOT,
    };
    const spy = jest.spyOn(modelEvent.Event, 'find');

    jest.spyOn(modelEvent.Event, 'find').mockReturnValue([
        event
    ]);
    //await mockingoose(modelEvent.Event).toReturn([event], 'find');
    const response = await request.get('/transactions/:address', req);
    
    expect(spy).toBeCalledTimes(1);
    expect(response.text).toBe(1);
});

it('test api 3', async () => {
    const req = {
        address: 'address',
        page: 2,
        currency: Currency.DOT,
    };
    
    const response = await request.get('/substrate/balance/:address', req);

    expect(response.text).toBe("{\"value\":\"231\"}");
});

it('test api 4', async () => {    
    const block = {
        _id: mongoose.Types.ObjectId(),
        hash: 'hash',
        number: '125',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
    };
    const spy = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block);
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block);
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block);
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block);

    const response = await request.get('/status');

    expect(spy).toBeCalledTimes(4);
    expect(response.text).toBe("{\"polkadot\":{\"lastHeight\":\"231\",\"lastScannedHeight\":\"0\",\"lastNotifiedHeight\":\"0\"},\"kusama\":{\"lastHeight\":\"231\",\"lastScannedHeight\":\"0\",\"lastNotifiedHeight\":\"0\"}}");
});

