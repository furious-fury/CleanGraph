import { defineChain, getAddress, isAddress, type Address, type Chain, type Hash } from "viem";

export interface MonadChainConfig {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  name?: string;
}

function validatePublicHttpsUrl(value: string, field: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${field} must be a valid URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError(`${field} must be a credential-free HTTPS URL without query or hash`);
  }
  return url;
}

export function createMonadChain(config: MonadChainConfig): Chain {
  if (!Number.isSafeInteger(config.chainId) || config.chainId <= 0) {
    throw new RangeError("chainId must be a positive safe integer");
  }
  const rpcUrl = validatePublicHttpsUrl(config.rpcUrl, "rpcUrl").toString();
  const explorerUrl = validatePublicHttpsUrl(config.explorerUrl, "explorerUrl").toString();
  const name = config.name?.trim() || "Monad";

  return defineChain({
    id: config.chainId,
    name,
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: `${name} Explorer`, url: explorerUrl } },
  });
}

function appendExplorerPath(explorerUrl: string, kind: "address" | "tx", value: string): string {
  const base = validatePublicHttpsUrl(explorerUrl, "explorerUrl");
  base.pathname = `${base.pathname.replace(/\/$/, "")}/${kind}/${value}`;
  return base.toString();
}

export function getExplorerAddressUrl(explorerUrl: string, address: Address): string {
  if (!isAddress(address, { strict: true })) throw new TypeError("address must be a valid EVM address");
  return appendExplorerPath(explorerUrl, "address", getAddress(address));
}

export function getExplorerTransactionUrl(explorerUrl: string, hash: Hash): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new TypeError("hash must be a transaction hash");
  return appendExplorerPath(explorerUrl, "tx", hash.toLowerCase());
}
