export enum TxAction {
    Transfer = 0,
    StakingReward,
    StakingWithdrawn,
    Staking
}

export enum TxStatus {
    Success = 0,
    Fail = 1
}

export enum BlockStatus {
    Pending,
    Success,
    Forked
}

export enum Network {
    Polkadot = "Polkadot",
    Kusama = "Kusama"
}
