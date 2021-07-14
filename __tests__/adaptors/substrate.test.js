import {SubstrateAdaptor} from "../../src/adaptors/substrate";
import { Currency } from "../../src/models/enums/currency";
import { ApiPromise, WsProvider } from '@polkadot/api';

jest.mock('@polkadot/api', () => ({
    ApiPromise: {
        api:jest.fn(),
        create: jest.fn(),
    },
    WsProvider: jest.fn(),
}));

it('SubstrateAdaptor getInstance', async () => {
    const currency = Currency.DOT;
    ApiPromise.create.mockReturnValueOnce();
    WsProvider.mockReturnValueOnce();
    await SubstrateAdaptor.getInstance('url', currency);

    expect(ApiPromise.create).toBeCalled();
});

it('SubstrateAdaptor getApi', async () => {
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor('url', currency);
    
    expect(await substrate.getApi()).toStrictEqual('url');
});

it('SubstrateAdaptor getCurrency', async () => {
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor('url', currency);
    
    expect(await substrate.getCurrency()).toStrictEqual(Currency.DOT);
});

it('SubstrateAdaptor getLastHeight', async () => {//вопрос в 33 стр
    const api = {
        rpc: {
            chain: {
                getHeader: jest.fn(() => ({
                    number: {
                        toBigInt: jest.fn(() => {
                            return 123n;
                        }),
                    }
                })),
            },
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getLastHeight()).toStrictEqual(123n);
});

it('SubstrateAdaptor getLastFinalizedHeight', async () => {//вопрос в 39 стр
    const api = {
        rpc: {
            chain: {
                getFinalizedHead: jest.fn(),
                getHeader: jest.fn(() => ({
                    number: {
                        toBigInt: jest.fn(() => {
                            return 123n;
                        }),
                    }
                })),
            },
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getLastFinalizedHeight()).toStrictEqual(123n);
});

it('SubstrateAdaptor getBlock', async () => {//вопрос в 39 стр
    const api = {
        rpc: {
            chain: {
                getBlockHash: jest.fn(() => ({
                    toHex: jest.fn(() => {
                        return 'hash';
                    }),
                })),
            },
        },
        query: {
            timestamp: {
                now: {
                    at: jest.fn(() => ({
                        toNumber: jest.fn(() => {
                            return 123;
                        }),
                    })),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getBlock(123n)).toStrictEqual({
            height: 123n,
            hash: 'hash',
            timestamp: 123,
    });
});

it('SubstrateAdaptor getTxsAndEvents with special hash', async () => {//вопрос в 39 стр
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor('api', currency);
    expect(await substrate.getTxsAndEvents('0xdc25e6ff4402f0bfb78d007cf364c9dded281b92f05fcb9aa22d067bdc7d5ccc')).toStrictEqual([]);
});

it('SubstrateAdaptor getTxsAndEvents with bad events', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
    .toStrictEqual([
        {
            "events": [], 
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 0
            }
        }
    ]);
});
it('SubstrateAdaptor getTxsAndEvents 1', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: 'data',
                                section: 'balances',
                                method: 'Transfer',
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
        .toStrictEqual([{
            "events": [
                {
                    "fee": "0",
                    "from": "d",
                    "id": "hash-0",
                    "to": "a",
                    "value": "t",
                }
            ],
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 0
            }
    }]);
});
it('SubstrateAdaptor getTxsAndEvents 2', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'balances',
                                method: 'Deposit',
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
        .toStrictEqual([{
            "events": [],
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 0
            }
    }]);
});
it('SubstrateAdaptor getTxsAndEvents 3', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'treasury',
                                method: 'Deposit',
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
        .toStrictEqual([{
            "events": [],
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 0
            }
    }]);
});
it('SubstrateAdaptor getTxsAndEvents 4', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'treasury',
                                method: 'Deposit',
                            },
                        },
                        {
                            phase: {
                                isApplyExtrinsic: false,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'treasury',
                                method: 'Deposit',
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
        .toStrictEqual([{
            "events": [],
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 0
            }
    }]);
});
it('SubstrateAdaptor getTxsAndEvents 5', async () => {
    const api = {
        rpc: {
            chain: {
                getBlock: jest.fn(() => ({
                    block: {
                        header: {
                            hash: 'hash',
                        },
                        extrinsics: [
                            {
                                hash: {
                                    toHex: jest.fn(),
                                },
                            },
                        ],
                    }
                })),
            },
        },
        query: {
            system: {
                events: {
                    at: jest.fn(() => [
                        {
                            phase: {
                                isApplyExtrinsic: true,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'system',
                                method: 'ExtrinsicFailed',
                            },
                        },
                        {
                            phase: {
                                isApplyExtrinsic: false,
                                asApplyExtrinsic: {
                                    eq: jest.fn(() => true)
                                }
                            },
                            event: {
                                data: [
                                    {
                                        toHex: jest.fn(() => 123),
                                    },
                                    {
                                        toHex: jest.fn(() => 1234),
                                    }
                                ],
                                section: 'treasury',
                                method: 'Deposit',
                            },
                        },
                    ]),
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getTxsAndEvents('hash'))
        .toStrictEqual([{
            "events": [],
            "transaction": {
                "hash": undefined,
                "id": "hash-0",
                "status": 1
            }
    }]);
});

it('SubstrateAdaptor getBalance', async () => {
    const api = {
        query: {
            system: {
                account: jest.fn(() =>(
                    {
                        data: {
                            free: {
                                toBigInt: jest.fn(() => 123n)
                            }
                        }
                    }
                ))
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getBalance('address')).toStrictEqual(123n);
});
