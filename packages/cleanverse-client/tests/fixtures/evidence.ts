export const evidenceWalletAddress =
  "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
export const evidenceCounterpartyAddress =
  "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";
export const evidenceTransactionHash = `0x${"A".repeat(64)}`;

export function transactionWireData() {
  return {
    chain: "monad",
    symbol: "TRWA",
    tx_hash: evidenceTransactionHash.toLowerCase(),
    from_address: evidenceWalletAddress.toLowerCase(),
    from_org_name: "",
    to_address: evidenceCounterpartyAddress,
    amount: "100000000000000000000",
    fee_amount: "0",
    pay_fee_index: 0,
    type: "transfer",
    block_number: 12_345_678,
    block_time: 1_786_120_100,
    status: "success",
    ignoredTransactionField: "discard-me",
  };
}

export function populatedTransactionsData() {
  return {
    total_count: 1,
    txs: [transactionWireData()],
    ignoredUpstreamField: "discard-me",
  };
}

export const emptyTransactionsData = {
  total_count: 0,
  txs: [],
  ignoredUpstreamField: "discard-me",
};

export const transactionReportData = {
  downloadUrl:
    "https://reports.cleanverse.example/download/transaction-token?signature=sanitized",
  fileName: "transaction_report_sanitized.pdf",
  ignoredUpstreamField: "discard-me",
};

export const travelRuleReportData = {
  downloadUrl:
    "https://reports.cleanverse.example/download/travel-rule-token",
  fileName: "travel_rule_sanitized.pdf",
};
