# AidFlow Live Native-GEN Settlement — Final Evidence

Only authoritative on-chain / RPC evidence is included. Raw artifacts: `artifacts/live_lifecycle_final.log`, `artifacts/live_settlement_pass.json`, `artifacts/live_settlement_fail.json`; scripts: `scripts/verify_live_lifecycle.mjs`, `scripts/live_settlement_proof.mjs`.

| Item | Value |
|---|---|
| Network | GenLayer StudioNet, chain ID `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Contract | `0x5Df5315274652629aFf67FC2D78921c5096Fe3ee` |
| Deployment tx | `0x6dd3e00ce9025bf43e0022da16ddf8228ea937d09bcad87b9edc76ac18012e8b` |
| Frontend SDK | `genlayer-js@1.1.8` |
| Production URL | https://aid-flow-gz8d.vercel.app |
| Donor / refund EOA | `0xE4220c4b71877bb94EB173f467ef5c5557017085` |

Every transaction below reached `FINALIZED` / `MAJORITY_AGREE` with a 5-validator committee (5 votes committed / 5 revealed). The only transactions that ended `FINISHED_WITH_ERROR` are the intentional second-claim attempts (rejected).

All post-claim balances were read independently by raw JSON-RPC `eth_getBalance` *after* the claim transaction finalized (not from any other transaction's pre-state), plus `get_claimable_balances`.

## PASS: create → fund → evidence → adjudicate PASS → release → claim_payout (campaign #4)

Recipient (fresh org EOA): `0x7e48a806f63d6020057f98177105d686e835b976`

| Step | GenLayer tx ID |
|---|---|
| create_campaign | `0x38345a94ffd29d62073432fdffd81c9d3a58e9de426f73610adcbbfc9291af65` |
| fund_campaign (0.1 GEN) | `0x1114ca52a1fbe713499ae34396c19d67c5b3c1ec07535df50195d818fcd48355` |
| submit_evidence ×3 | `0x0652ede8…08d3`, `0xfe34f9f4832f9ef978ebc0066b322348fc4cfe71ac7621ea5d30ef0a8cd2491e`, `0xa0e8049c44b6efaeae60c1ecbcfb4587fcda339660fe27afc69873e2399af406` |
| adjudicate_milestone → `PASSED` | `0x4d6ad85c790b5523a7aa4010e2bf724e3255164b3349f29ae11ab9c300f9c0c8` |
| release_milestone | `0xa4f39c3b75c0270ab1af8b824381d9fb86c3d25d01808673e5436b79a97603d4` |
| claim_payout | `0xdbc1a2a9ab2209fb87fec726b9aa53d0a5883e77c0cee8782c6a173dc82b2d45` |
| claim_payout (2nd, rejected) | `0x09c4e3e07d0e4e726d9de0f5926eaf999c31ec3f16139b1be3d11b6fd5b53047` |

(Full `submit_evidence` tx ID #1: `0x0652ede8d31f835fff8b8588102f95bad6529417a60a71639341d3ef99b508d3`.)

| Balance (wei) | Pre-claim | Post-claim (independent, post-finality) |
|---|---|---|
| Recipient EOA | 0 | 100000000000000000 (+0.1 GEN) |
| `org_claimable` | 100000000000000000 | 0 |
| Contract escrow | 200000000000000000 | 100000000000000000 (−0.1 GEN) |

Second claim: finalized with `FINISHED_WITH_ERROR` (rejected); recipient EOA unchanged.

## FAIL: create → fund → evidence → adjudicate FAIL → refund_campaign → claim_refund (campaign #3)

| Step | GenLayer tx ID |
|---|---|
| create_campaign | `0x5ae33c2f74504bdc3dc24b6b6ab5faf013c943883766acfda285ea4478839405` |
| fund_campaign (0.1 GEN) | `0xc6f024b26958e39bed81806788c887b47062715b7efc18106675c5f58b6b29e2` |
| submit_evidence | `0x6c7d4f9ada910dbba571da716c75b673176305ae9a5c72dd79bea5205968bcd5` |
| adjudicate_milestone → `FAILED` | `0xbdbd689ced37bad7a3435dbb115b0e0c72ffc152a583dd303c796b4893c03e01` |
| refund_campaign | `0xf4e44fc7c8c0818d5544cb5e0541e2972da17ba8fac308c263915d4abc658a60` |
| claim_refund | `0x7570a567ce0222bc1fdbff3502d1e584eaa49591c09b45cd2b0c15bfaeed64d9` |
| claim_refund (2nd, rejected) | `0x6e01e721e8ef9778b7301433ca6c50455855de0e18cebc97d43cb94332fd7b5f` |

| Balance (wei) | Pre-claim | Post-claim (independent, post-finality) |
|---|---|---|
| Donor EOA | 997779440503506922349093 | 997779540503506922349093 (+0.1 GEN) |
| `donor_claimable` | 100000000000000000 | 0 |
| Contract escrow | 200000000000000000 | 100000000000000000 (−0.1 GEN) |

Second claim: finalized with `FINISHED_WITH_ERROR` (rejected); donor EOA unchanged.

## Escrow note

Escrow at the end of each branch is `0.1 GEN`, not `0`, because of campaign #2: the first PASS-branch attempt (single receipt, tx IDs in `artifacts/live_lifecycle_final.log`) was adjudicated `INCONCLUSIVE` by the validators, so its 0.1 GEN correctly stayed locked. Its throwaway org key was not retained. Campaigns #3 and #4 each settled their own 0.1 GEN fully (per-campaign escrow decreased by exactly the claimed amount to zero; claimables zero). Campaign #2 is a separate, still-locked escrow.

The PASS campaign #4 was created with a policy requiring invoice + delivery receipt + beneficiary sign-off, and three descriptive evidence records; these are test fixtures, not real-world aid records.
