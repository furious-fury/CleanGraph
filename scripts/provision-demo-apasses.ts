import { createHash } from "node:crypto";

import { CleanverseClient } from "../packages/cleanverse-client/src/index.js";

type DemoProfile = {
  label: "A" | "B" | "C";
  address: string;
  country: "BR" | "GB";
  customerId: string;
};

const customerIdPattern = /^[A-Za-z0-9]{12,}$/;
const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/;

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set in the current shell.`);
  }

  return value;
}

function profile(
  label: DemoProfile["label"],
  country: DemoProfile["country"],
): DemoProfile {
  const address = requireEnvironment(`WALLET_${label}`);
  const customerId = requireEnvironment(`CUSTOMER_${label}`);

  if (!evmAddressPattern.test(address)) {
    throw new Error(`WALLET_${label} must be a valid EVM address.`);
  }

  if (!customerIdPattern.test(customerId)) {
    throw new Error(
      `CUSTOMER_${label} must contain at least 12 letters or numbers and no punctuation.`,
    );
  }

  return { label, address, country, customerId };
}

async function main(): Promise<void> {
  const baseUrl = process.env.CLEANVERSE_BASE_URL?.trim();
  const client = new CleanverseClient({
    apiId: requireEnvironment("CLEANVERSE_API_ID"),
    apiKey: requireEnvironment("CLEANVERSE_API_KEY"),
    timeoutMs: Number(process.env.CLEANVERSE_TIMEOUT_MS ?? "10000"),
    ...(baseUrl ? { baseUrl } : {}),
  });
  const expirationTime = Math.floor(Date.now() / 1_000) + 60 * 60 * 24 * 365;
  const profiles = [profile("A", "GB"), profile("C", "GB"), profile("B", "BR")];

  for (const item of profiles) {
    const documentHash = createHash("sha256")
      .update(`cleangraph-fictional-demo-${item.label}-${item.address.toLowerCase()}`)
      .digest("hex");

    await client.generateAPass({
      customerId: item.customerId,
      override: false,
      expirationTime,
      wallet: { chain: "monad", address: item.address },
      identityDataList: [
        {
          idType: "PASSPORT",
          fullName: `CleanGraph Demo ${item.label}`,
          idNumber: documentHash,
          validUntil: "2099-12-31",
          issuingCountryISO2: item.country,
        },
      ],
    });

    const result = await client.queryAPass({
      chain: "monad",
      address: item.address,
    });

    console.log(
      JSON.stringify({
        wallet: item.label,
        address: item.address,
        status: result.data.status,
        expirationTime: result.data.expirationTime,
        group: result.data.group,
        subGroup: result.data.subGroup,
        countries: result.data.countries,
      }),
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "A-Pass provisioning failed.";
  console.error(message);
  process.exitCode = 1;
});
