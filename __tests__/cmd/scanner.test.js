import { scan } from '../../src/cmd/scanner';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';
import {Block, IBlock} from "../../src/models/db/block";
import { Schema, Types } from 'mongoose'

const mockingoose = require('mockingoose');

const modelTxs = require('transaction');
const modelBlock = require('block');
const modelEvent = require('event');

//jest.setTimeout(15000);
jest.mock('@polkadot/api', () => ({
    ApiPromise: {
        api:jest.fn(),
        create: jest.fn(),
    },
    WsProvider: jest.fn(),
}));

jest.mock('mongoose', () => ({
    ...jest.requireActual('mongoose'),
    Types: {
        ObjectId: jest.fn()
    }
}));

const adaptor = {
    getCurrency: jest.fn(),

    getLastHeight: jest.fn(),

    getLastFinalizedHeight: jest.fn(),

    getBlock: jest.fn(() => {
        return {
            hash: 'hash',
            timestamp: 123,
        };
    }),

    getTxsAndEvents: jest.fn(),

    getBalance: jest.fn(),
}
async function scanFunc() {
    try {
        await scan(123n, 125n, Network.Polkadot, adaptor)
    }
    catch (e) {
        console.log(e);
    }
}

it('scanner scan', async () => {
    /*Types.mockImplementationOnce({
        ObjectId: jest.fn()
    });
    Schema.mockImplementationOnce({
        Types: {
            ObjectId: jest.fn()
        }
    });*/

    const model = {
        txId: 'txId',
        hash: 'hash',
        status: TxStatus.Success,
        block: IBlock,
    }
    mockingoose(modelBlock).toReturn(finderMock, 'findOne');

    Block.findOne.mockReturnValueOnce({
        hash: 'hash',
        number: '123',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true
    });
    expect(await scanFunc()).toStrictEqual('');
});