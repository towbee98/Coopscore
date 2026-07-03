// Nomba virtual account provisioning — coopscore-architecture-v1.md §4.1.
// Sandbox credentials aren't wired up yet (see coopscore-handoff-v4.md open
// questions), so this throws a clear, typed error until NOMBA_* env vars are
// set, rather than silently mocking a fake account number.
import { env } from "../config/env.js";
import { ApiException } from "../lib/api-exception.js";

export interface ProvisionedAccount {
  accountNumber: string;
  bankName: string;
  providerResponse: unknown;
}

interface NombaVirtualAccountResponse {
  data: {
    accountNumber: string;
    bankName: string;
  };
}

export async function provisionAccount(accountRef: string): Promise<ProvisionedAccount> {
  if (!env.NOMBA_CLIENT_ID || !env.NOMBA_PRIVATE_KEY || !env.NOMBA_ACCOUNT_ID) {
    throw new ApiException(
      "PROVISIONING_FAILED",
      "Nomba credentials are not configured (NOMBA_CLIENT_ID / NOMBA_PRIVATE_KEY / NOMBA_ACCOUNT_ID)",
      502,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${env.NOMBA_BASE_URL}/v1/accounts/virtual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: env.NOMBA_ACCOUNT_ID,
        // TODO: confirm Nomba's actual auth header scheme against sandbox docs
        // once credentials are issued — this is a best-effort placeholder, not
        // verified against a live call yet.
        Authorization: `Bearer ${env.NOMBA_PRIVATE_KEY}`,
      },
      body: JSON.stringify({ accountRef }),
    });
  } catch (cause) {
    throw new ApiException("PROVISIONING_FAILED", "Could not reach Nomba", 502, { cause });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiException("PROVISIONING_FAILED", "Nomba rejected the provisioning request", 502, {
      status: response.status,
      body,
    });
  }

  const payload = (await response.json()) as NombaVirtualAccountResponse;

  return {
    accountNumber: payload.data.accountNumber,
    bankName: payload.data.bankName,
    providerResponse: payload,
  };
}
