import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';
import { Currency } from '../../src/models/enums/currency';
import { SubstrateAdaptor } from '../../src/adaptors/substrate';
import request from "supertest"

const app = require('../../src/cmd/api');
const supertest = require('supertest');
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
}));
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
beforeAll(done => {
    done()
  })
  
  afterAll(done => {
    // Closing the DB connection allows Jest to exit successfully.
    mongoose.connection.close()
    done()
  })

it('test api 1', async () => {
    const block1 = {
        hash: 'hash',
        number: '125',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
    }
    
    const block2 = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
    };
    
    const tx1 = {
        txId: 'txId',
        hash: 'hash',
        status: 1,
        block: block1,
    };
    const tx2 = {
        txId: 'txId',
        hash: 'hash2',
        status: 1,
        block: block2,
    };
    const txs = [tx1, tx2];
    
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
    const spy = jest.spyOn(modelEvent.Event, 'find');

    jest.spyOn(modelEvent.Event, 'find').mockReturnValueOnce({
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

it('test api 3', async () => {
    const response = await request(app).get('/substrate/balance/:address');
    expect(response.text).toBe("{\"value\":\"231\"}");
});

it('test api 4', async () => {    
    const block = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
    };
   
    const spy = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block)
    });
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({
        sort: jest.fn(() => block)
    });
    const response = await request(app).get('/status');

    expect(spy).toBeCalledTimes(4);
    expect(response.text).toBe("{\"polkadot\":{\"lastHeight\":\"231\",\"lastScannedHeight\":\"126\",\"lastNotifiedHeight\":\"126\"},\"kusama\":{\"lastHeight\":\"231\",\"lastScannedHeight\":\"126\",\"lastNotifiedHeight\":\"126\"}}");
});

