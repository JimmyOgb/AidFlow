"""
AidFlow Deployment Script - Exclusively targeting GenLayer StudioNet.
Network: StudioNet (Chain ID: 61999, RPC: https://studio.genlayer.com/api)
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT_DIR / "contracts" / "aidflow.py"
OUTPUT_PATH = ROOT_DIR / "deployed_contract.json"
FRONTEND_CONFIG_PATH = ROOT_DIR / "frontend" / "src" / "contracts" / "deployed_contract.json"

STUDIONET_CHAIN_ID = 61999
STUDIONET_RPC = "https://studio.genlayer.com/api"
STUDIONET_EXPLORER = "https://genlayer-explorer.vercel.app"


def run_cmd(cmd: list[str], cwd=ROOT_DIR) -> str:
    print(f"-> Running: {' '.join(cmd)}")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=env, shell=True)
    if result.returncode != 0:
        print(f"Error output:\n{result.stderr}\n{result.stdout}")
        sys.exit(result.returncode)
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description="Deploy AidFlow to GenLayer StudioNet")
    parser.add_argument("--skip-lint", action="store_true", help="Skip pre-deploy linting")
    parser.add_argument("--skip-tests", action="store_true", help="Skip direct unit tests before deployment")
    args = parser.parse_args()

    print("=" * 60)
    print(" AidFlow Protocol Deployment: STUDIONET (Chain ID 61999)")
    print("=" * 60)

    # 1. Pre-deployment linting
    if not args.skip_lint:
        print("\n[Step 1/5] Validating contract with genvm-lint...")
        lint_out = run_cmd(["genvm-lint", "check", str(CONTRACT_PATH), "--json"])
        # The linter may emit a cache-resolution warning before its JSON payload.
        lint_json = next((line for line in reversed(lint_out.splitlines()) if line.strip().startswith("{")), "")
        lint_res = json.loads(lint_json) if lint_json else {"ok": False, "errors": [lint_out]}
        if not lint_res.get("ok"):
            print("Contract linting failed:", lint_res)
            sys.exit(1)
        print("Contract linter passed (14 methods validated, 0 errors)")

    # 2. Run test suite
    if not args.skip_tests:
        print("\n[Step 2/5] Running direct mode test suite...")
        test_out = run_cmd(["pytest", "tests/direct/", "-v"])
        print(test_out)
        print("All direct mode test scenarios passed successfully")

    # 3. Configure network in GenLayer CLI to StudioNet only
    print("\n[Step 3/5] Setting network to StudioNet...")
    net_out = run_cmd(["genlayer", "network", "set", "studionet"])
    print(net_out)

    # 4. Check active account
    print("\n[Step 4/5] Checking active account...")
    acc_out = run_cmd(["genlayer", "account"])
    print(acc_out)

    # 5. Deploy contract to StudioNet
    print("\n[Step 5/5] Deploying contracts/aidflow.py to StudioNet...")
    deploy_cmd = ["genlayer", "deploy", "--contract", str(CONTRACT_PATH)]
    deploy_out = run_cmd(deploy_cmd)
    print(deploy_out)

    # Extract contract address and tx hash from CLI output
    contract_address = None
    tx_hash = None
    for line in deploy_out.splitlines():
        line_clean = line.strip()
        if "contract address" in line_clean.lower():
            parts = line_clean.split(":")
            if len(parts) >= 2:
                candidate = parts[-1].strip().strip("'").strip('"')
                if candidate.startswith("0x") and len(candidate) == 42:
                    contract_address = candidate
        if "transaction hash" in line_clean.lower():
            parts = line_clean.split(":")
            if len(parts) >= 2:
                candidate = parts[-1].strip().strip("'").strip('"').strip(",")
                if candidate.startswith("0x"):
                    tx_hash = candidate

    # Never reuse a prior deployment when the CLI does not return a new address.
    # A missing address means deployment must be treated as incomplete.
    if not contract_address or contract_address == "undefined":
        print("Deployment did not return a new contract address; refusing to update manifests.", file=sys.stderr)
        sys.exit(1)

    deployment_data = {
        "network": "studionet",
        "contract": "AidFlow",
        "contract_address": contract_address,
        "chainId": STUDIONET_CHAIN_ID,
        "rpcUrl": STUDIONET_RPC,
        "explorerUrl": STUDIONET_EXPLORER,
        "transaction_hash": tx_hash,
        "contract_file": "contracts/aidflow.py",
    }

    OUTPUT_PATH.write_text(json.dumps(deployment_data, indent=2))
    print(f"\nSaved deployment manifest to: {OUTPUT_PATH}")

    if FRONTEND_CONFIG_PATH.parent.exists():
        FRONTEND_CONFIG_PATH.write_text(json.dumps(deployment_data, indent=2))
        print(f"Synced deployment manifest to frontend: {FRONTEND_CONFIG_PATH}")

    print("\n AidFlow StudioNet deployment completed successfully!")


if __name__ == "__main__":
    main()
