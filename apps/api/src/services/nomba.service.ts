// Nomba virtual account provisioning — coopscore-architecture-v1.md §4.1.
// Confirmed against developer.nomba.com/docs: creating a virtual account
// requires a short-lived access token obtained via the client-credentials
// flow first, then a separate authenticated call to create the account.
import { env } from "../config/env.js";
import { ApiException } from "../lib/api-exception.js";

export interface ProvisionedAccount {
  accountNumber: string;
  bankName: string;
  providerResponse: unknown;
}

interface NombaTokenResponse {
  code: string;
  data: {
    access_token: string;
  };
}

interface NombaVirtualAccountResponse {
  code: string;
  data: {
    bankAccountNumber: string;
    bankName: string;
  };
}

async function getAccessToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${env.NOMBA_BASE_URL}/v1/auth/token/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: env.NOMBA_ACCOUNT_ID ?? "",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env.NOMBA_CLIENT_ID,
        client_secret: env.NOMBA_CLIENT_SECRET,
      }),
    });
  } catch (cause) {
    throw new ApiException("PROVISIONING_FAILED", "Could not reach Nomba", 502, { cause });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiException("PROVISIONING_FAILED", "Nomba rejected the token request", 502, {
      status: response.status,
      body,
    });
  }

  const payload = (await response.json()) as NombaTokenResponse;
  return payload.data.access_token;
}

export async function provisionAccount(
  accountRef: string,
  accountName: string,
): Promise<ProvisionedAccount> {
  if (!env.NOMBA_CLIENT_ID || !env.NOMBA_CLIENT_SECRET || !env.NOMBA_ACCOUNT_ID) {
    throw new ApiException(
      "PROVISIONING_FAILED",
      "Nomba credentials are not configured (NOMBA_CLIENT_ID / NOMBA_CLIENT_SECRET / NOMBA_ACCOUNT_ID)",
      502,
    );
  }

  const accessToken = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${env.NOMBA_BASE_URL}/v1/accounts/virtual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: env.NOMBA_ACCOUNT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ accountRef, accountName }),
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
    accountNumber: payload.data.bankAccountNumber,
    bankName: payload.data.bankName,
    providerResponse: payload,
  };
}
