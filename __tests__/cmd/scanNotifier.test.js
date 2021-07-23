import { scan } from '../../src/cmd/scanNotifier';
import { Currency } from '../../src/models/enums/currency';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';

const mongoose = require('mongoose');
const mockingoose = require('mockingoose');
const modelBlock = require('../../src/models/db/block');
const modelEvent = require('../../src/models/db/event');
const modelTransaction = require('../../src/models/db/transactions');

it('test scanNotifier 1', async () => {
    const block1 = await modelBlock.Block.create({
        _id: mongoose.Types.ObjectId(),
        hash: 'hash',
        number: '125',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false
    });
    
    const spy = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block1);

    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(123n);
    expect(spy).toBeCalledTimes(2);
});
it('test scanNotifier 2', async () => {
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
    const event = await modelEvent.Event.create({
        eventId: 'eventId',
        block: block,
        transaction:  tx,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false
    });    

    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue(block);

    const spyEvent = jest.spyOn(modelEvent.Event, 'find');
    jest.spyOn(modelEvent.Event, 'find').mockReturnValue([event]);

    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(123n);
    expect(spyBlock).toBeCalledTimes(1);
    expect(spyEvent).toBeCalledTimes(1);
});
it('test scanNotifier 3', async () => {
    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne');
    jest.spyOn(modelBlock.Block, 'findOne').mockReturnValue({});
    
    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(123n);
    expect(spyBlock).toBeCalledTimes(1);
});

