export enum TxAction {
    Transfer,
    StakingReward,
    StakingCreateWithdrawalRequest,
    StakingWithdrawn,
    StakingOpenDeposit,
    StakingAddAmount,
    ConfirmWithdrawal,
    UpdateNomination
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
