import { NextResponse } from "next/server";
import { SUPPORTED_CHAINS } from "@6flow/shared/supportedChain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain");
  const address = searchParams.get("address");

  if (!chain || !address) {
    return NextResponse.json(
      { error: "Missing required parameters: chain, address" },
      { status: 400 },
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid contract address" },
      { status: 400 },
    );
  }

  const supportedChain = SUPPORTED_CHAINS.find(
    (c) => c.chainSelectorName === chain,
  );
  if (!supportedChain) {
    return NextResponse.json(
      { error: "Unsupported chain" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ETHER_SCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Etherscan API key not configured" },
      { status: 500 },
    );
  }

  const url = `https://api.etherscan.io/v2/api?apikey=${apiKey}&chainid=${supportedChain.chainId}&module=contract&action=getabi&address=${address}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "1") {
      return NextResponse.json({ abi: JSON.parse(data.result) });
    }

    // Contract not verified or other Etherscan error
    return NextResponse.json(
      { error: "not_verified", message: data.result },
      { status: 404 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch ABI from Etherscan" },
      { status: 502 },
    );
  }
}
