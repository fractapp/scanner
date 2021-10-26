import {SubstrateAdaptor} from "../../src/adaptors/substrate";
import { Currency } from "../../src/models/enums/currency";
import { ApiPromise, WsProvider } from '@polkadot/api';
import {TxAction, TxStatus} from "../../src/models/enums/status";

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

    console.log(await substrate.getBaseApi())
    expect(await substrate.getBaseApi()).toStrictEqual('url');
});

it('SubstrateAdaptor getCurrency', async () => {
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor('url', currency);

    expect(await substrate.getCurrency()).toStrictEqual(Currency.DOT);
});

it('SubstrateAdaptor getLastHeight', async () => {
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

it('SubstrateAdaptor getLastFinalizedHeight', async () => {
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

it('SubstrateAdaptor getTxsAndEvents', async () => {
    const getBlockMock = jest.fn()
    const eventsMock = jest.fn()
    const api = {
        rpc: {
            chain: {
                getBlock: getBlockMock
            },
        },
        query: {
            system: {
                events: {
                    at: eventsMock,
                }
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);

    const exHash = "exHash"
    const blockHash = "blockHash"
    getBlockMock.mockReturnValueOnce({
        block: {
            header: {
                hash: blockHash,
            },
            extrinsics: [
                {
                    hash: {
                        toHex: () => exHash
                    },
                },
            ],
        }
    })

    const events = [
        {
            phase: {
                isApplyExtrinsic: true,
                asApplyExtrinsic: {
                    eq: jest.fn(() => true)
                }
            },
            event: {
                data: [
                    "from",
                    "to",
                    "10000"
                ],
                section: 'balances',
                method: 'Transfer',
            },
        },
        {
            phase: {
                isApplyExtrinsic: true,
                asApplyExtrinsic: {
                    eq: jest.fn(() => true)
                }
            },
            event: {
                data: [
                    "to",
                    "10000"
                ],
                section: 'staking',
                method: 'Rewarded',
            },
        },
        {
            phase: {
                isApplyExtrinsic: true,
                asApplyExtrinsic: {
                    eq: jest.fn(() => true)
                }
            },
            event: {
                data: [
                    "to",
                    "10000"
                ],
                section: 'staking',
                method: 'Withdrawn',
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
                    "to",
                    "10000"
                ],
                section: 'staking',
                method: 'Withdrawn',
            },
        },
        {
            phase: {
                isApplyExtrinsic: true,
                asApplyExtrinsic: {
                    eq: jest.fn(() => true)
                }
            },
            event: {
                data: [
                    "to",
                    "10000"
                ],
                section: 'blabla',
                method: 'blabla',
            },
        },
        {
            phase: {
                isApplyExtrinsic: true,
                asApplyExtrinsic: {
                    eq: jest.fn(() => true)
                }
            },
            event: {
                data: [
                    "to",
                    {
                        toHex: () => "0x10000"
                    }
                ],
                section: 'balances',
                method: 'Deposit',
            },
        },
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
                        toHex: () => "0x10000"
                    }
                ],
                section: 'treasury',
                method: 'Deposit',
            },
        },
    ]
    eventsMock.mockReturnValueOnce(events)

    expect(await substrate.getTxsAndEvents('hash')).toStrictEqual([
        {
            transaction: {
                error: "",
                hash: exHash,
                id: "hash-0",
                status: TxStatus.Success
            },
            events: [
                {
                    action: TxAction.Transfer,
                    fee: "131072",
                    from: "from",
                    id: "hash-0",
                    to: "to",
                    value: "10000",
                },
                {
                    action: TxAction.StakingReward,
                    fee: "131072",
                    from: "to",
                    id: "hash-1",
                    to: "to",
                    value: "10000",
                },
                {
                    action: TxAction.StakingWithdrawn,
                    fee: "131072",
                    from: "to",
                    id: "hash-2",
                    to: "to",
                    value: "10000",
                },
            ]
        }
    ]);
});

it('SubstrateAdaptor getBalance', async () => {
    const api = {
        query: {
            staking: {
                ledger: jest.fn((address) => ({
                    isNone: true
                })),
            },
            system: {
                account: jest.fn(() =>(
                    {
                        data: {
                            free: {
                                toBigInt: jest.fn(() => 1000n)
                            },
                            reserved: {
                                toBigInt: jest.fn(() => 2000n)
                            },
                            miscFrozen: {
                                toBigInt: jest.fn(() => 100n)
                            },
                            feeFrozen: {
                                toBigInt: jest.fn(() => 200n)
                            },
                        }
                    }
                ))
            }
        },
    };
    const currency = Currency.DOT;
    const substrate = new SubstrateAdaptor(api, currency);
    expect(await substrate.getBalance('address')).toStrictEqual({
        total: 3000n,
        transferable: 900n,
        payableForFee: 800n,
        staking: 0n
    });
});
