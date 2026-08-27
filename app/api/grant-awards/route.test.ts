import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createGrantAwardPostHandler, type GrantAwardRouteDependencies } from "@/lib/grant-reports/grant-award-route";

const body = { sourceType:"MANUAL",centreId:"centre-1",fundingProjectId:"project-1",awardNumber:"AW-1",title:"Award",awardedAmount:100,currency:"ZAR",startDate:"2026-08-01",organisationType:"FUNDING_ORGANISATION",fundingOrganisationId:"org-1",signedAgreementFileAssetId:"file-1" };

function dependencies(overrides: Partial<GrantAwardRouteDependencies> = {}): GrantAwardRouteDependencies {
  return { authorize:async()=>({internalUser:{id:"internal-admin"}}),createAward:async()=>({id:"award-1"}),rollbackAgreement:async()=>undefined,...overrides };
}

test("the production award route uses database-backed report authorization",()=>{
  const source=readFileSync("app/api/grant-awards/route.ts","utf8");
  assert.match(source,/authorize: requireReportAdmin/);
  assert.doesNotMatch(source,/unsafeMetadata|publicMetadata|sessionClaims/);
});

test("unauthorized award creation is rejected before parsing, upload attachment or mutation",async()=>{
  let created=false;
  const handler=createGrantAwardPostHandler(dependencies({authorize:async()=>({error:Response.json({ok:false},{status:403})}),createAward:async()=>{created=true;return{};}}));
  const response=await handler(new Request("https://ecdlink.test/api/grant-awards",{method:"POST",body:JSON.stringify(body)}));
  assert.equal(response.status,403);
  assert.equal(created,false);
});

test("failed award creation rolls back the staged agreement using the internal actor",async()=>{
  let rollback:unknown;
  const handler=createGrantAwardPostHandler(dependencies({createAward:async()=>{throw new Error("database failure");},rollbackAgreement:async(input)=>{rollback=input;}}));
  const response=await handler(new Request("https://ecdlink.test/api/grant-awards",{method:"POST",body:JSON.stringify(body)}));
  assert.equal(response.status,500);
  assert.deepEqual(rollback,{actorUserId:"internal-admin",fileAssetId:"file-1"});
  assert.doesNotMatch(await response.text(),/database failure/);
});
