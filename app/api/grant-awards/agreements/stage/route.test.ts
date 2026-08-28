import assert from "node:assert/strict";
import test from "node:test";
import { createAgreementStageHandler, type AgreementStageRouteDependencies } from "@/lib/grant-reports/agreement-stage-route";

function dependencies(overrides: Partial<AgreementStageRouteDependencies> = {}): AgreementStageRouteDependencies {
  return { authorize:async()=>({internalUser:{id:"internal-admin"}}),checkOrigin:()=>null,checkRateLimit:async()=>null,validateRequest:()=>({valid:true}),stage:async()=>({id:"file-1",originalFilename:"agreement.pdf",mimeType:"application/pdf",fileSize:100,checksum:"hash",createdAt:new Date(0)}),...overrides };
}

test("unauthorized agreement upload is denied before request validation or storage",async()=>{
  let staged=false;
  const handler=createAgreementStageHandler(dependencies({authorize:async()=>({error:Response.json({ok:false},{status:403})}),stage:async()=>{staged=true;throw new Error("should not run");}}));
  const response=await handler(new Request("https://ecdlink.test/api/grant-awards/agreements/stage",{method:"POST"}));
  assert.equal(response.status,403);
  assert.equal(staged,false);
});

test("authorized staging returns safe FileAsset metadata without a public or storage URL",async()=>{
  let rateChecks=0;
  const form=new FormData();
  form.set("file",new File(["%PDF-1"],"agreement.pdf",{type:"application/pdf"}));
  const response=await createAgreementStageHandler(dependencies({checkRateLimit:async()=>{rateChecks+=1;return null;}}))(new Request("https://ecdlink.test/api/grant-awards/agreements/stage",{method:"POST",body:form}));
  const text=await response.text();
  assert.equal(response.status,201);
  assert.doesNotMatch(text,/storageKey|signedUrl|https:\/\//);
  assert.match(text,/agreement\.pdf/);
  assert.equal(rateChecks,1);
});
