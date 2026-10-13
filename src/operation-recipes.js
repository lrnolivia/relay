import { TOOL_DESIGN_STANDARD_VERSION } from "./operations.js";

export const OPERATION_RECIPE_CONTRACT_VERSION = TOOL_DESIGN_STANDARD_VERSION;

const recipe = value => Object.freeze({
  version: OPERATION_RECIPE_CONTRACT_VERSION,
  kind: "recipe",
  retry_policy: "operation-status-first",
  bounded_output: true,
  ...value,
  steps: Object.freeze(value.steps.map(step=>Object.freeze(step))),
  resume_points: Object.freeze(value.resume_points),
  completion: Object.freeze(value.completion),
  recovery: Object.freeze(value.recovery)
});

export const OPERATION_RECIPE_CONTRACTS = Object.freeze([
  recipe({
    id:"ship-change",
    intent:"Take an admitted source change from exact branch state through PR/check/merge evidence without bypassing Runner or protection.",
    family:"source",
    authority:["relay.RUNNER","relay.SOURCE"],
    steps:[
      {id:"preflight",tool:"relay_runner_preflight",mode:"query"},
      {id:"publish",tool:"relay_source_open_pull_request",mode:"command"},
      {id:"checks",tool:"relay_source_checks",mode:"query"},
      {id:"merge",tool:"relay_source_pull_request_action",mode:"command"}
    ],
    resume_points:["after-preflight","after-pr","waiting-checks","after-merge"],
    completion:{requires:["merged_pr","exact_merge_sha"]},
    recovery:{uncertain_write:"read PR/head before retry",conflict:"refresh branch/PR and Runner state"}
  }),
  recipe({
    id:"publish-worker",
    intent:"Publish an exact merged source commit as a Cloudflare Worker version, deploy only through canonical project authority, then verify runtime separately.",
    family:"cloud",
    authority:["relay.CLOUD","relay.RUNNER","relay.VERIFY"],
    steps:[
      {id:"authority",tool:"relay_cloud_project",mode:"query"},
      {id:"upload",tool:"relay_cloud_upload_version",mode:"command"},
      {id:"deploy",tool:"relay_cloud_deploy_project_version",mode:"command"},
      {id:"verify",tool:"relay_verify_evidence_plan",mode:"query"}
    ],
    resume_points:["after-authority","after-upload","after-deploy","waiting-verification"],
    completion:{requires:["exact_source_version","deployment_identity","runtime_evidence"]},
    recovery:{uncertain_write:"read Worker/deployment state before retry",permission:"refresh project + runtime allowlist authority"}
  }),
  recipe({
    id:"qa-then-merge",
    intent:"Collect deterministic QA evidence for an exact source identity before allowing the corresponding pull request to merge.",
    family:"verify",
    authority:["relay.VERIFY","relay.SOURCE","relay.RUNNER"],
    steps:[
      {id:"plan",tool:"relay_verify_evidence_plan",mode:"query"},
      {id:"evidence",tool:"relay_verify_browser_recipe",mode:"query"},
      {id:"checks",tool:"relay_source_checks",mode:"query"},
      {id:"merge",tool:"relay_source_pull_request_action",mode:"command"}
    ],
    resume_points:["after-plan","waiting-evidence","waiting-checks"],
    completion:{requires:["identity-bound_qa","green_checks","merged_pr"]},
    recovery:{stale_evidence:"recapture against current identity",conflict:"refresh PR head before merge"}
  }),
  recipe({
    id:"rollback-release",
    intent:"Recover from a bad release using previously recorded exact source/version/deployment identity without bypassing production authority.",
    family:"operations",
    authority:["relay.CLOUD","relay.RUNNER","relay.VERIFY"],
    steps:[
      {id:"read-current",tool:"relay_cloud_project",mode:"query"},
      {id:"select-known-good",tool:"operation_receipt_lookup",mode:"query"},
      {id:"deploy-known-good",tool:"relay_cloud_deploy_project_version",mode:"command"},
      {id:"verify",tool:"relay_verify_evidence_plan",mode:"query"}
    ],
    resume_points:["after-read","after-selection","after-deploy"],
    completion:{requires:["known_good_identity","rollback_deployment","post_rollback_evidence"]},
    recovery:{missing_receipt:"require explicit known-good identity",uncertain_write:"read deployment history before retry"}
  })
]);

export function operationRecipe(id){
  return OPERATION_RECIPE_CONTRACTS.find(item=>item.id===id)||null;
}
